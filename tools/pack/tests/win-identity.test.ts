import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createLauncherRuntimeSyncPowerShellScript } from "../src/win/custom-installer.js";
import { resolveWinInstallIdentity } from "../src/win/identity.js";

const execFileAsync = promisify(execFile);

describe("resolveWinInstallIdentity", () => {
  it("keeps the default namespace on the canonical Windows display name", () => {
    expect(resolveWinInstallIdentity({ namespace: "default" })).toMatchObject({
      displayName: "Root Editor",
      shortcutName: "Root Editor.lnk",
      uninstallerName: "Uninstall Root Editor.exe",
    });
  });

  it("uses the canonical Windows display name for stable release namespaces", () => {
    expect(resolveWinInstallIdentity({ namespace: "release-stable-win" })).toMatchObject({
      appPathsKey: "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Root Editor.exe",
      displayName: "Root Editor",
      registryKey: "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Root Editor-release-stable-win",
      shortcutName: "Root Editor.lnk",
      uninstallerName: "Uninstall Root Editor.exe",
    });
  });

  it("uses first-class beta display identity for beta release namespaces", () => {
    expect(resolveWinInstallIdentity({ namespace: "release-beta-win" })).toMatchObject({
      appPathsKey: "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Root Editor Beta.exe",
      displayName: "Root Editor Beta",
      registryKey: "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Root Editor-release-beta-win",
      shortcutName: "Root Editor Beta.lnk",
      uninstallerName: "Uninstall Root Editor Beta.exe",
    });
  });

  it("keeps non-release beta-like namespaces isolated from the real beta channel identity", () => {
    expect(resolveWinInstallIdentity({ namespace: "beta-local-flow" })).toMatchObject({
      appPathsKey: "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Root Editor beta-local-flow.exe",
      displayName: "Root Editor beta-local-flow",
      registryKey: "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Root Editor-beta-local-flow",
      shortcutName: "Root Editor beta-local-flow.lnk",
      uninstallerName: "Uninstall Root Editor beta-local-flow.exe",
    });
  });

  it("uses first-class preview display identity for preview release namespaces", () => {
    expect(resolveWinInstallIdentity({ namespace: "release-preview-win" })).toMatchObject({
      appPathsKey: "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Root Editor Preview.exe",
      displayName: "Root Editor Preview",
      registryKey: "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Root Editor-release-preview-win",
      shortcutName: "Root Editor Preview.lnk",
      uninstallerName: "Uninstall Root Editor Preview.exe",
    });
  });

  it("uses first-class prerelease display identity for prerelease release versions and namespaces", () => {
    expect(resolveWinInstallIdentity({
      appVersion: "0.8.0-prerelease.2",
      namespace: "release-stable-win",
    })).toMatchObject({
      appPathsKey: "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Root Editor Prerelease.exe",
      displayName: "Root Editor Prerelease",
      registryKey: "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Root Editor-release-stable-win",
      shortcutName: "Root Editor Prerelease.lnk",
      uninstallerName: "Uninstall Root Editor Prerelease.exe",
    });
    expect(resolveWinInstallIdentity({ namespace: "release-prerelease-win" })).toMatchObject({
      displayName: "Root Editor Prerelease",
      shortcutName: "Root Editor Prerelease.lnk",
    });
  });

  it("keeps the registry DisplayName free of the package version", async () => {
    const source = await readFile(new URL("../src/win/custom-installer.ts", import.meta.url), "utf8");
    expect(source).toContain('WriteRegStr HKCU "${registryKey}" "DisplayName" "${productName}"');
    expect(source).not.toContain('"DisplayName" "${productName} \\${APP_VERSION}"');
  });

  it("checks the silent install target directory for running instances before overwriting files", async () => {
    const source = await readFile(new URL("../src/win/custom-installer.ts", import.meta.url), "utf8");
    const silentCheck = source.slice(source.indexOf("silent_check:"), source.indexOf("IfFileExists \"$INSTDIR\\\\${exeName}\" existing_install"));
    expect(silentCheck).toContain('IfFileExists "$INSTDIR\\\\${exeName}" 0 silent_detect_running_instances');
    expect(silentCheck).toContain('StrCpy $RunningInstancesInstallRoot "$INSTDIR"');
    expect(silentCheck.indexOf('StrCpy $RunningInstancesInstallRoot "$INSTDIR"')).toBeLessThan(
      silentCheck.indexOf("Call DetectRunningInstances"),
    );
  });

  it("syncs launcher runtime metadata after a successful Windows install", async () => {
    const source = await readFile(new URL("../src/win/custom-installer.ts", import.meta.url), "utf8");
    expect(source).toContain("Function SyncLauncherRuntime");
    expect(source).toContain("sync-launcher-runtime.ps1");
    expect(source).toContain("-CleanupPath");
    expect(source).toContain("current-bound-package");
    expect(source).toContain("older-than-bound-package");
    expect(source).toContain("[System.IO.File]::WriteAllText($CleanupPath");
    expect(source).toContain('Push "event=launcher_runtime_after_write path=${escapedRuntimePath}"');
    expect(source.indexOf('Push "event=registry_after_write key=${registryKey} appPathsKey=${appPathsKey}"')).toBeLessThan(
      source.indexOf("Call SyncLauncherRuntime"),
    );
    expect(source.indexOf("Call SyncLauncherRuntime")).toBeLessThan(source.indexOf('Push "install section done"'));
  });

  it.skipIf(process.platform !== "win32")("writes cleanup metadata when installer runtime sync supersedes an older runtime", async () => {
    const root = await mkdtemp(join(tmpdir(), "od-pack-launcher-sync-"));
    const runtimePath = join(root, "launcher", "channels", "beta", "namespaces", "cf", "runtime.json");
    const attemptsPath = join(root, "launcher", "channels", "beta", "namespaces", "cf", "state", "attempt.json");
    const cleanupPath = join(root, "launcher", "channels", "beta", "namespaces", "cf", "state", "cleanup.json");
    const scriptPath = join(root, "sync-launcher-runtime.ps1");

    try {
      await mkdir(join(root, "launcher", "channels", "beta", "namespaces", "cf", "state"), { recursive: true });
      await writeFile(
        runtimePath,
        `${JSON.stringify({
          active: { generation: 1, version: "0.10.2-beta.9" },
          channel: "beta",
          lastSuccessful: { generation: 0, version: "0.10.1-beta.1" },
          namespace: "cf",
          schemaVersion: 1,
        })}\n`,
        "utf8",
      );
      await writeFile(
        attemptsPath,
        `${JSON.stringify({
          channel: "beta",
          generation: 1,
          namespace: "cf",
          schemaVersion: 1,
          version: "0.10.2-beta.9",
        })}\n`,
        "utf8",
      );
      await writeFile(scriptPath, createLauncherRuntimeSyncPowerShellScript(), "utf8");

      await execFileAsync("powershell.exe", [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-RuntimePath",
        runtimePath,
        "-AttemptsPath",
        attemptsPath,
        "-CleanupPath",
        cleanupPath,
        "-Channel",
        "beta",
        "-Namespace",
        "cf",
        "-Version",
        "0.10.2-beta.10",
      ], { windowsHide: true });

      expect(JSON.parse(await readFile(runtimePath, "utf8"))).toMatchObject({
        active: { generation: 0, version: "0.10.2-beta.10" },
        channel: "beta",
        lastSuccessful: { generation: 0, version: "0.10.2-beta.10" },
        namespace: "cf",
        schemaVersion: 1,
      });
      await expect(access(attemptsPath)).rejects.toThrow();
      expect(JSON.parse(await readFile(cleanupPath, "utf8"))).toMatchObject({
        channel: "beta",
        currentVersion: "0.10.2-beta.10",
        namespace: "cf",
        version: 1,
        versions: expect.arrayContaining([
          expect.objectContaining({ reason: "older-than-bound-package", state: "deprecated", version: "0.10.2-beta.9" }),
          expect.objectContaining({ reason: "older-than-bound-package", state: "deprecated", version: "0.10.1-beta.1" }),
          expect.objectContaining({ reason: "current-bound-package", state: "retained", version: "0.10.2-beta.10" }),
        ]),
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("keeps installer diagnostic log events ASCII-only for silent overwrite", async () => {
    const source = await readFile(new URL("../src/win/custom-installer.ts", import.meta.url), "utf8");
    expect(source).toContain('Push "existing installation found; silent install will overwrite it"');
    expect(source).not.toContain('Push "$(ExistingInstallSilentOverwrite)"');
  });
});
