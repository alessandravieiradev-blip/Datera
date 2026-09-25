import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { DateraApi, IPC, LogEntry } from "../shared/api";

const api: DateraApi = {
    getSettings: () => ipcRenderer.invoke(IPC.getSettings),
    chooseConfig: () => ipcRenderer.invoke(IPC.chooseConfig),
    run: (request) => ipcRenderer.invoke(IPC.run, request),
    listHistory: () => ipcRenderer.invoke(IPC.listHistory),
    openHelp: () => ipcRenderer.invoke(IPC.openHelp),
    readConfig: () => ipcRenderer.invoke(IPC.readConfig),
    saveConfig: (config) => ipcRenderer.invoke(IPC.saveConfig, config),
    createConfig: (config) => ipcRenderer.invoke(IPC.createConfig, config),
    readColumns: () => ipcRenderer.invoke(IPC.readColumns),
    pickFile: (kind) => ipcRenderer.invoke(IPC.pickFile, kind),
    pickSaveFile: (kind) => ipcRenderer.invoke(IPC.pickSaveFile, kind),
    onLog: (listener) => {
        const handler = (_event: IpcRendererEvent, entry: LogEntry) =>
            listener(entry);
        ipcRenderer.on(IPC.log, handler);
        return () => {
            ipcRenderer.removeListener(IPC.log, handler);
        };
    },
};

contextBridge.exposeInMainWorld("datera", api);
