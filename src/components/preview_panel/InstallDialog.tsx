import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  DownloadIcon,
  Loader2,
  Terminal,
  XCircle,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { IpcClient } from "@/ipc/ipc_client";
import { IpcRenderer } from "electron";

interface InstallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type InstallStatus = "idle" | "installing" | "success" | "error";

export function InstallDialog({
  isOpen,
  onClose,
  onSuccess,
}: InstallDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [installOutput, setInstallOutput] = useState<string[]>([]);
  const [installStatus, setInstallStatus] = useState<InstallStatus>("idle");
  const terminalRef = useRef<HTMLDivElement>(null);

  // Function to reset all dialog state
  const resetDialogState = () => {
    setIsDownloading(false);
    setInstallOutput([]);
    setInstallStatus("idle");
  };

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [installOutput]);

  // Reset state when dialog closes or reopens
  useEffect(() => {
    if (!isOpen) {
      resetDialogState();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const ipcRenderer = (window as any).electron.ipcRenderer as IpcRenderer;
    ipcRenderer.on("sui:install:response", (data) => {
      if (
        data &&
        typeof data === "object" &&
        "line" in data &&
        "inProgress" in data
      ) {
        const { line, inProgress } = data as {
          line: string;
          inProgress: boolean;
        };
        if (inProgress) {
          setInstallOutput((prev) => {
            if (prev.length === 0) return [line];
            return [...prev.slice(0, -1), line];
          });
        } else {
          setInstallOutput((prev) => [...prev, line]);
        }
      }
    });

    return () => {
      ipcRenderer.removeListener("sui:install:response", (_event, line) => {
        setInstallOutput((prev) => [...prev, line]);
      });
    };
  }, [isOpen]);

  // Wrap the original onClose to also reset state
  const handleClose = () => {
    onClose();
  };

  const handleDownload = async () => {
    if (installStatus === "success") {
      return;
    }
    setIsDownloading(true);
    setInstallStatus("installing");
    setInstallOutput([]);
    try {
      const result = await IpcClient.getInstance().suiInstall();
      if (result.success) {
        setInstallStatus("success");
        onSuccess();
      } else {
        setInstallStatus("error");
      }
    } catch (error) {
      setInstallStatus("error");
      setInstallOutput((prev) => [
        ...prev,
        "",
        `✗ Installation failed: ${error}`,
      ]);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Sui CLI Installation
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <div>
              To compile & deploy to Sui, we need to download the Sui CLI (~800MB)
            </div>
            <div>This happens once, then it's cached.</div>
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 flex flex-col flex-1 min-h-0">
          {installOutput.length === 0 && (
            <div className="text-sm text-muted-foreground space-y-2 pb-4">
              <p>The installation will perform the following steps:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Create directory: ~/.shinso/bin/</li>
                <li>Download Sui CLI from GitHub (~800MB)</li>
                <li>Extract tarball</li>
                <li>Copy sui binary to ~/.shinso/bin/</li>
                <li>Set executable permissions (chmod +x)</li>
                <li>Verify installation</li>
              </ul>
            </div>
          )}

          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={isDownloading || installStatus === "success"}
            className="w-full py-6 mb-4 cursor-pointer"
          >
            {installStatus === "installing" && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {installStatus === "success" && (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}
            {installStatus === "error" && (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            {installStatus === "idle" && (
              <DownloadIcon className="h-5 w-5" />
            )}
            {installStatus === "installing"
              ? "Installing..."
              : installStatus === "success"
                ? "Installation Complete ✓"
                : installStatus === "error"
                  ? "Installation Failed - Try Again"
                  : "Start Installation"}
          </Button>

          {installOutput.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-[400px]">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                <Terminal className="w-4 h-4" />
                Terminal Output
              </div>
              <div
                ref={terminalRef}
                className="flex-1 overflow-y-auto bg-slate-950 text-green-400 rounded-lg p-4 font-mono text-sm shadow-inner border border-slate-800"
                style={{
                  fontFamily:
                    '"Cascadia Code", "Fira Code", "Consolas", monospace',
                }}
              >
                {installOutput.map((line, index) => {
                  // Parse line to add colors
                  let className = "leading-relaxed";

                  if (line.startsWith("$")) {
                    // Command lines
                    className = "text-cyan-400 font-semibold leading-relaxed";
                  } else if (line.startsWith("✓")) {
                    // Success lines
                    className = "text-green-400 leading-relaxed";
                  } else if (line.startsWith("✗") || line.startsWith("⚠")) {
                    // Error/Warning lines
                    className = "text-red-400 leading-relaxed";
                  } else if (
                    line.includes("Progress:") ||
                    line.includes("%") ||
                    line.includes("[")
                  ) {
                    // Progress lines
                    className = "text-yellow-300 leading-relaxed";
                  } else if (line.includes("---") || line.includes("===")) {
                    // Section dividers
                    className = "text-blue-400 leading-relaxed";
                  } else if (line.trim().startsWith("Step ")) {
                    // Step headers
                    className = "text-purple-400 font-semibold leading-relaxed";
                  } else if (line.trim() === "") {
                    // Empty lines - preserve
                    return <div key={index} className="h-4"></div>;
                  }

                  return (
                    <div key={index} className={className}>
                      {line}
                    </div>
                  );
                })}
                {isDownloading && (
                  <div className="text-cyan-400 mt-2 flex items-center gap-2">
                    <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse"></span>
                  </div>
                )}
              </div>
            </div>
          )}

          {installStatus === "success" && (
            <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 p-3 rounded-md mt-4">
              ✓ Sui CLI has been successfully installed and is ready to use!
            </div>
          )}

          {installStatus === "error" && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-3 rounded-md mt-4">
              ✗ Installation failed. Please check the terminal output above for
              details.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
