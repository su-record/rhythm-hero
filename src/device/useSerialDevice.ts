import { useCallback, useEffect, useRef, useState } from "react";

import { appStore } from "../store/appStore.ts";
import { SERIAL_BAUD_RATE, buildLedPayload, parseHardwareLine } from "./protocol.ts";

interface SerialState {
  port: SerialPort | null;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  writer: WritableStreamDefaultWriter<Uint8Array> | null;
  connected: boolean;
  buffer: string;
  lastPayload: string;
}

function emptyDevice(): SerialState {
  return { port: null, reader: null, writer: null, connected: false, buffer: "", lastPayload: "" };
}

export interface SerialDevice {
  connected: boolean;
  supported: boolean;
  connect: () => Promise<"connected" | "cancelled" | "failed" | "unsupported">;
  disconnect: () => Promise<void>;
}

export function useSerialDevice(onButton: (index: number) => void): SerialDevice {
  const device = useRef<SerialState>(emptyDevice());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [connected, setConnected] = useState(false);
  const supported = typeof navigator !== "undefined" && "serial" in navigator;
  const press = useRef(onButton);
  press.current = onButton;

  const disconnect = useCallback(async () => {
    const { port, reader, writer } = device.current;
    device.current.connected = false;
    device.current.lastPayload = "";
    try { await reader?.cancel(); } catch { /* the reader may already be closed */ }
    try { writer?.releaseLock(); } catch { /* the writer may already be released */ }
    device.current.reader = null;
    device.current.writer = null;
    try { await port?.close(); } catch { /* some browsers close the port for us */ }
    device.current.port = null;
    setConnected(false);
  }, []);

  const readLoop = useCallback(async () => {
    const decoder = new TextDecoder();
    try {
      while (device.current.port?.readable && device.current.connected) {
        const reader = device.current.port.readable.getReader();
        device.current.reader = reader;
        try {
          while (device.current.connected) {
            const { value, done } = await reader.read();
            if (done) break;
            device.current.buffer += decoder.decode(value, { stream: true });
            const lines = device.current.buffer.split(/\r?\n/);
            device.current.buffer = lines.pop() || "";
            lines.forEach((line) => {
              const index = parseHardwareLine(line);
              if (index) press.current(index);
              else if (line.trim()) console.warn("Rhythm Hero ignored an unknown serial line", line.trim());
            });
          }
        } finally {
          // Always give the lock back, or the next connect cannot read.
          reader.releaseLock();
          device.current.reader = null;
        }
        break;
      }
    } catch (error) {
      if (device.current.connected) {
        console.warn("Rhythm Hero serial read failed", error);
        await disconnect();
      }
    }
  }, [disconnect]);

  const connect = useCallback(async () => {
    if (!supported) return "unsupported" as const;
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: SERIAL_BAUD_RATE });
      if (!port.writable) {
        await port.close();
        return "failed" as const;
      }
      device.current.port = port;
      device.current.writer = port.writable.getWriter();
      device.current.connected = true;
      device.current.lastPayload = "";
      setConnected(true);
      void readLoop();
      return "connected" as const;
    } catch (error) {
      return (error as DOMException)?.name === "NotFoundError" ? ("cancelled" as const) : ("failed" as const);
    }
  }, [supported, readLoop]);

  // Push LED state whenever it actually differs from what the board last saw.
  useEffect(() => {
    const send = () => {
      if (!device.current.connected || !device.current.writer) return;
      const payload = buildLedPayload(appStore.getState());
      const fingerprint = JSON.stringify(payload);
      if (fingerprint === device.current.lastPayload) return;
      device.current.lastPayload = fingerprint;
      const writer = device.current.writer;
      queue.current = queue.current
        .then(() => writer.write(new TextEncoder().encode(`${fingerprint}\n`)))
        .catch((error) => {
          console.warn("Rhythm Hero serial write failed", error);
          void disconnect();
        });
    };
    send();
    return appStore.subscribe(send);
  }, [connected, disconnect]);

  useEffect(() => {
    if (!supported) return;
    const handleDisconnect = (event: Event) => {
      if (event.target === device.current.port) void disconnect();
    };
    navigator.serial.addEventListener("disconnect", handleDisconnect);
    return () => navigator.serial.removeEventListener("disconnect", handleDisconnect);
  }, [supported, disconnect]);

  useEffect(() => () => void disconnect(), [disconnect]);

  return { connected, supported, connect, disconnect };
}
