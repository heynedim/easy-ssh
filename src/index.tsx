import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  ToggleField,
  Field,
  TextField,
  staticClasses,
} from "@decky/ui";
import { callable, definePlugin, toaster } from "@decky/api";
import { useState, useEffect } from "react";
import { FaTerminal } from "react-icons/fa";

const getSshStatus = callable<[], { active: boolean, enabled: boolean }>("get_ssh_status");
const setSshEnabled = callable<[enabled: boolean, pwd: string], { active: boolean, enabled: boolean }>("set_ssh_enabled");
const getIpAddress = callable<[], string>("get_ip_address");
const getPluginLogs = callable<[], string[]>("get_plugin_logs");
const clearPluginLogs = callable<[], string[]>("clear_plugin_logs");

function Content() {
  const [sshStatus, setSshStatus] = useState({ active: false, enabled: false });
  const [ipAddress, setIpAddress] = useState("");
  const [lastAction, setLastAction] = useState<string>("Ready");
  const [backendLogs, setBackendLogs] = useState<string[]>([]);
  const [useDefaultPassword, setUseDefaultPassword] = useState<boolean>(true);

  const updateStatus = async () => {
    try {
      const status = await getSshStatus();
      setSshStatus(status);
      const ip = await getIpAddress();
      setIpAddress(ip);
      const logs = await getPluginLogs();
      setBackendLogs(logs || []);
    } catch (err: any) {
      console.error("Failed to update SSH status", err);
      setLastAction(`Error checking status: ${err.toString?.() || "Unknown"}`);
    }
  };

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSsh = async (enabled: boolean) => {
    const activeSudoKey = useDefaultPassword ? "ssap" : "";

    // Optimistic UI update to prevent bounce
    setSshStatus({ active: enabled, enabled: enabled });
    setLastAction(enabled ? "Starting SSH..." : "Stopping SSH...");

    try {
      const newStatus = await setSshEnabled(enabled, activeSudoKey);
      setSshStatus(newStatus);

      if (enabled && newStatus.active) {
        setLastAction("SSH is currently Running");
        toaster.toast({ title: "Easy SSH", body: "SSH Enabled Successfully" });
      } else if (!enabled && !newStatus.active) {
        setLastAction("SSH is currently Stopped");
        toaster.toast({ title: "Easy SSH", body: "SSH Disabled Successfully" });
      } else {
        // The backend returned a status that doesn't match our request
        throw new Error(`State mismatch: Expected ${enabled}, got ${newStatus.active}`);
      }
    } catch (err: any) {
      console.error("Failed to set SSH enabled", err);
      const errMsg = err.toString?.() || "Unknown error";
      setLastAction(`Toggle Error: ${errMsg}`);
      toaster.toast({ title: "SSH Error", body: errMsg });
      updateStatus();
    }
  };

  return (
    <PanelSection>
      <PanelSectionRow>
        <ToggleField
          label="Enable SSH"
          description={sshStatus.active ? "Running" : "Stopped"}
          checked={sshStatus.enabled}
          onChange={handleToggleSsh}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          label="Use Default Password"
          description={useDefaultPassword ? "Password is 'ssap'" : "Password is blank"}
          checked={useDefaultPassword}
          onChange={(checked) => setUseDefaultPassword(checked)}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <Field label="Current IP Address" description={ipAddress || "Detecting..."} />
      </PanelSectionRow>
      <PanelSectionRow>
        <Field label="System Log" description={
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ opacity: 0.9 }}>{lastAction}</div>
            {backendLogs.length > 0 && <div style={{ marginTop: "4px", fontSize: "12px", opacity: 0.6, borderTop: "1px solid #444", paddingTop: "4px" }}>
              {backendLogs.map((lg, i) => <div key={i}>{lg}</div>)}
            </div>}
          </div>
        } />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={async () => {
          setLastAction("Cleared");
          const clearedLogs = await clearPluginLogs();
          setBackendLogs(clearedLogs || []);
        }}>
          Clear Log
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}

export default definePlugin(() => {
  return {
    name: "Easy SSH",
    titleView: <div className={staticClasses.Title}>Easy SSH</div>,
    content: <Content />,
    icon: <FaTerminal />,
    onDismount() { },
  };
});
