import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const python = process.env.ACE_STEP_PYTHON || 'E:/AI/ACE-Step-1.5-venv311/Scripts/python.exe';
const root = process.env.ACE_STEP_ROOT || 'E:/AI/ACE-Step-1.5';
if (!fs.existsSync(python) || !fs.existsSync(root)) { console.log(JSON.stringify({ available: false, reason: 'isolated ACE-Step installation not found', python, root }, null, 2)); process.exitCode = 1; }
else { const output = execFileSync(python, ['-c', 'import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu")'], { encoding: 'utf8' }).trim(); console.log(JSON.stringify({ available: true, python, root, runtime: output }, null, 2)); }
