/// <reference types="vite/client" />

/* File System Access API 的类型补齐。
   TS 的 lib.dom 只声明了句柄对象本身（FileSystemHandle / FileSystemFileHandle），
   而取文件的 showOpenFilePicker 和权限方法（queryPermission / requestPermission）
   是 Chromium 的扩展，库里没有，用接口合并补上。
   这两个成员运行时只存在于 Chromium，用 pickerSupported() 判断后再调用。 */

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface OpenFilePickerOptions {
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
}

interface FileSystemHandle {
  queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor
  ): Promise<PermissionState>;
  requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor
  ): Promise<PermissionState>;
}

interface Window {
  showOpenFilePicker?(
    options?: OpenFilePickerOptions
  ): Promise<FileSystemFileHandle[]>;
}
