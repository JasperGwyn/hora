import { spawn } from "node:child_process";
import { access, cp, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const unpackedDir = join(root, "dist", "win-unpacked");

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} salió con código ${code ?? "null"}`));
    });
  });
}

async function pathExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function findInstallDir() {
  const fromEnv = process.env.HORA_INSTALL_DIR;
  if (fromEnv && (await pathExists(join(fromEnv, "Hora.exe")))) {
    return fromEnv;
  }

  const candidates = [
    join(process.env.LOCALAPPDATA ?? "", "Programs", "Hora"),
    join(process.env.ProgramFiles ?? "", "Hora"),
    join(process.env["ProgramFiles(x86)"] ?? "", "Hora"),
  ].filter((dir) => dir.length > "Hora".length);

  for (const dir of candidates) {
    if (await pathExists(join(dir, "Hora.exe"))) {
      return dir;
    }
  }

  throw new Error(
    "No encontré Hora instalada. Instalá una vez con npm run dist, o definí HORA_INSTALL_DIR.",
  );
}

function stopHora() {
  return new Promise((resolve, reject) => {
    const child = spawn("taskkill", ["/IM", "Hora.exe", "/F"], {
      stdio: "ignore",
      shell: true,
    });
    child.on("error", reject);
    child.on("exit", () => {
      resolve();
    });
  });
}

async function copyWithRetry(src, dest) {
  let lastError = new Error("No se pudo copiar");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await cp(src, dest, { recursive: true });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const code =
        error !== null && typeof error === "object" && "code" in error
          ? error.code
          : undefined;
      if (code !== "EBUSY" && code !== "EPERM" && code !== "EACCES") {
        throw lastError;
      }
      await delay(250);
    }
  }
  throw lastError;
}

async function patchInstall(installDir) {
  const names = await readdir(unpackedDir);
  for (const name of names) {
    if (name.startsWith("Uninstall")) {
      continue;
    }
    await copyWithRetry(join(unpackedDir, name), join(installDir, name));
  }
}

function refreshWindowsIcons(installDir) {
  return run("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    join(root, "scripts", "refresh-windows-icons.ps1"),
    "-InstallDir",
    installDir,
  ]);
}

function launchHora(installDir) {
  const child = spawn(join(installDir, "Hora.exe"), [], {
    cwd: installDir,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function main() {
  const installDir = await findInstallDir();
  console.log(`Instalación: ${installDir}`);

  console.log("1/4 Compilando…");
  await run("npm", ["run", "build"]);

  console.log("2/4 Empaquetando (sin instalador)…");
  await run("npx", ["electron-builder", "--win", "dir"]);

  if (!(await pathExists(join(unpackedDir, "Hora.exe")))) {
    throw new Error(`No apareció ${join(unpackedDir, "Hora.exe")}`);
  }

  console.log("3/4 Cerrando Hora y copiando archivos…");
  await stopHora();
  await delay(400);
  await patchInstall(installDir);
  await refreshWindowsIcons(installDir);

  console.log("4/4 Abriendo Hora…");
  launchHora(installDir);
  console.log("Listo. La app instalada ya tiene el update.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
