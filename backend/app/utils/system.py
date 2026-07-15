import subprocess
import logging
import os

logger = logging.getLogger("cloudbanana")

def run_command(command: list[str], timeout: int = 60) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True,
            timeout=timeout
        )
        return True, result.stdout
    except subprocess.TimeoutExpired:
        logger.error(f"Command timed out: {' '.join(command)}")
        return False, "Command timed out"
    except subprocess.CalledProcessError as e:
        logger.error(f"Command failed: {' '.join(command)} | Error: {e.stderr}")
        return False, e.stderr
    except Exception as e:
        logger.error(f"Unexpected error executing command: {str(e)}")
        return False, str(e)


def run_as_root(command: list[str], timeout: int = 60, input_data: str | None = None) -> tuple[bool, str]:
    """Run a command as root via sudo if not already root."""
    if os.geteuid() == 0:
        return run_command(command, timeout)
    cmd = ["sudo", "-n"] + command
    logger.debug(f"Running as root: {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout,
            input=input_data,
        )
        if result.returncode == 0:
            return True, result.stdout
        err = result.stderr or result.stdout or "Command failed"
        logger.error(f"Root command failed: {' '.join(cmd)} | {err}")
        return False, err
    except subprocess.TimeoutExpired:
        return False, "Command timed out"
    except Exception as e:
        logger.error(f"Unexpected error in run_as_root: {str(e)}")
        return False, str(e)


def spawn_root_process(command: list[str], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=None):
    """Spawn a subprocess as root (used for long-running background tasks)."""
    if os.geteuid() == 0:
        return subprocess.Popen(command, stdout=stdout, stderr=stderr, text=text, env=env)
    cmd = ["sudo", "-n"] + command
    return subprocess.Popen(cmd, stdout=stdout, stderr=stderr, text=text, env=env)
