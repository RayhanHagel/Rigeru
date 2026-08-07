import os
import subprocess
import contextvars

# Context variable to hold a queue.Queue for streaming output
current_log_queue = contextvars.ContextVar('current_log_queue', default=None)

def run_cmd(cmd: str) -> tuple[str, str]:
    """
    Runs a terminal command.
    If current_log_queue is set, it streams stdout and stderr to the queue line-by-line,
    and returns (combined_output, "").
    If not set, it acts like a normal subprocess.run and returns (stdout, stderr).
    """
    q = current_log_queue.get()
    
    startupinfo = None
    if os.name == 'nt':
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

    if q is None:
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True,
                startupinfo=startupinfo, encoding='utf-8', errors='ignore'
            )
            return result.stdout.strip(), result.stderr.strip()
        except Exception as e:
            return "", str(e)
    else:
        q.put(f"> {cmd}\n")
        try:
            process = subprocess.Popen(
                cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding='utf-8', errors='ignore', startupinfo=startupinfo,
                bufsize=1
            )
            out_lines = []
            if process.stdout:
                for line in iter(process.stdout.readline, ''):
                    q.put(line)
                    out_lines.append(line)
            process.stdout.close()
            process.wait()
            return "".join(out_lines).strip(), ""
        except Exception as e:
            err_msg = f"Exception: {str(e)}\n"
            q.put(err_msg)
            return "", str(e)


def run_cmd_single(cmd: str) -> str:
    """
    Like run_cmd, but only returns stdout (or combined output if streaming).
    Used for winget where stderr is typically ignored.
    """
    out, err = run_cmd(cmd)
    return out
