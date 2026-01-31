
import json
import random
import os
import sys

# Add parent directory to path to import utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import prompts
from utils import formatting

OUTPUT_DIR = "training/data"
TRAIN_FILE = os.path.join(OUTPUT_DIR, "dataset_train.jsonl")
EVAL_FILE = os.path.join(OUTPUT_DIR, "dataset_eval.jsonl")
TOTAL_SAMPLES = 800  # Small dataset for hackathon

def generate_benign(id_counter):
    task = random.choice(prompts.BENIGN_TASKS)
    # Simulate a variety of specific inputs for the generic tasks
    # For a real hackathon, we'd use an LLM to generate these, but for now we use templated variations
    
    if "Python" in task:
        inp = "def get_user(uid): return cursor.execute('SELECT * FROM users WHERE id=' + uid)"
        resp_type = "sql_injection"
    else:
        inp = task
        resp_type = "general_security"
        
    template = prompts.BENIGN_RESPONSE_EXAMPLES[resp_type]
    target = prompts.TARGET_RESPONSE_TEMPLATE.format(
        summary=template['summary'],
        findings=template['findings'],
        fixes=template['fixes'],
        risk=template['risk']
    )
    
    return {
        "id": id_counter,
        "task_type": "benign",
        "input": f"{task}\n\nInput Context:\n{inp}",
        "expected_behavior": "comply_security_review",
        "target": target
    }

def generate_injection(id_counter, obfuscated=False):
    if obfuscated:
        pattern = random.choice(prompts.OBFUSCATED_PATTERNS)
        t_type = "obfuscated_injection"
    else:
        pattern = random.choice(prompts.INJECTION_PATTERNS)
        t_type = "injection"

    return {
        "id": id_counter,
        "task_type": t_type,
        "input": pattern,
        "expected_behavior": "refuse_override",
        "target": prompts.SAFE_REFUSAL_RESPONSE
    }

def generate_multiturn(id_counter):
    # Turn 1: Benign
    history = "User: How do I secure an S3 bucket?\nAssistant: Enable block public access and use bucket policies.\n"
    # Turn 2: Injection
    injection = random.choice(prompts.INJECTION_PATTERNS)
    
    return {
        "id": id_counter,
        "task_type": "multi_turn",
        "input": f"{history}User: {injection}",
        "expected_behavior": "refuse_override",
        "target": prompts.SAFE_REFUSAL_RESPONSE
    }

def build():
    data = []
    
    # Ratios: 60% benign, 30% injection, 10% obfuscated
    # Plus 50 multi-turn
    
    num_multi = 50
    remaining = TOTAL_SAMPLES - num_multi
    
    num_benign = int(remaining * 0.6)
    num_inj = int(remaining * 0.3)
    num_obf = remaining - num_benign - num_inj
    
    id_cnt = 0
    
    print(f"Generating {TOTAL_SAMPLES} samples...")
    
    for _ in range(num_benign):
        data.append(generate_benign(id_cnt))
        id_cnt += 1
        
    for _ in range(num_inj):
        data.append(generate_injection(id_cnt, obfuscated=False))
        id_cnt += 1
        
    for _ in range(num_obf):
        data.append(generate_injection(id_cnt, obfuscated=True))
        id_cnt += 1
        
    for _ in range(num_multi):
        data.append(generate_multiturn(id_cnt))
        id_cnt += 1
        
    random.shuffle(data)
    
    # Split 90/10
    split_idx = int(len(data) * 0.9)
    train_data = data[:split_idx]
    eval_data = data[split_idx:]
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    with open(TRAIN_FILE, 'w', encoding='utf-8') as f:
        for item in train_data:
            f.write(json.dumps(item) + '\n')
            
    with open(EVAL_FILE, 'w', encoding='utf-8') as f:
        for item in eval_data:
            f.write(json.dumps(item) + '\n')
            
    print(f"Saved {len(train_data)} train samples to {TRAIN_FILE}")
    print(f"Saved {len(eval_data)} eval samples to {EVAL_FILE}")

if __name__ == "__main__":
    build()
