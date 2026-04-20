import os
import subprocess
import socket
import asyncio
import decky
from datetime import datetime

class Plugin:
    def __init__(self):
        self.plugin_logs = ["Plugin Initialized"]

    def log_message(self, level: str, message: str):
        log_str = f"[{datetime.now().strftime('%H:%M:%S')}] {level}: {message}"
        if level == "ERROR":
            decky.logger.error(message)
        else:
            decky.logger.info(message)
            
        self.plugin_logs.insert(0, log_str)
        if len(self.plugin_logs) > 15:
            self.plugin_logs.pop()

    async def get_plugin_logs(self):
        return self.plugin_logs

    async def clear_plugin_logs(self):
        self.plugin_logs = [f"[{datetime.now().strftime('%H:%M:%S')}] INFO: Logs cleared by user"]
        return self.plugin_logs

    def _run_command(self, cmd, input_text=None):
        env = os.environ.copy()
        env.pop('LD_LIBRARY_PATH', None)
        env.pop('LD_PRELOAD', None)
        return subprocess.run(cmd, input=input_text, capture_output=True, text=True, env=env)

    async def get_ssh_status(self):
        try:
            active_cmd = self._run_command(['systemctl', 'is-active', 'sshd'])
            enabled_cmd = self._run_command(['systemctl', 'is-enabled', 'sshd'])
            return {
                "active": active_cmd.stdout.strip() == "active",
                "enabled": enabled_cmd.stdout.strip() == "enabled"
            }
        except Exception as e:
            self.log_message("ERROR", f"Error checking SSH status: {e}")
            return {"active": False, "enabled": False}

    async def get_ip_address(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('10.255.255.255', 1))
            IP = s.getsockname()[0]
        except Exception:
            IP = '127.0.0.1'
        finally:
            s.close()
        return IP

    async def set_ssh_enabled(self, enabled: bool, pwd: str):
        try:
            self.log_message("INFO", f"Attempting to {'enable' if enabled else 'disable'} SSH with sudo...")
            
            cmd = ['sudo', '-S', 'systemctl', 'enable', '--now', 'sshd'] if enabled else ['sudo', '-S', 'systemctl', 'disable', '--now', 'sshd']
            result = self._run_command(cmd, input_text=pwd + "\n")
                
            if result.returncode != 0:
                error_msg = f"sudo exited with {result.returncode}: {result.stderr.strip()}"
                self.log_message("ERROR", error_msg)
                raise Exception(error_msg)
                
            self.log_message("INFO", f"Successfully {'enabled' if enabled else 'disabled'} SSH.")
            return await self.get_ssh_status()
        except Exception as e:
            self.log_message("ERROR", f"SSH action failed: {repr(e)}")
            raise e

    async def _main(self):
        self.loop = asyncio.get_event_loop()
        self.log_message("INFO", "Easy SSH started!")

    async def _unload(self):
        self.log_message("INFO", "Easy SSH unloaded!")
        pass

    # Function called after `_unload` during uninstall
    async def _uninstall(self):
        decky.logger.info("Easy SSH uninstalled!")
        pass

    # Migrations that should be performed before entering `_main()`.
    async def _migration(self):
        pass
