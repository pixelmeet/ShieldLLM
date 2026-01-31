
import os
import sys
import argparse
import torch
import json
from datasets import load_dataset
from tqdm import tqdm
from peft import PeftModel, PeftConfig
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

# Add parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import formatting, metrics

def evaluate(args):
    print(f"Evaluating Primary Model: {args.model_id} with adapter {args.adapter_dir}")

    # Load Base Model (Quantized evaluation)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
    )
    
    model = AutoModelForCausalLM.from_pretrained(
        args.model_id,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True
    )
    
    # Load Adapter
    model = PeftModel.from_pretrained(model, args.adapter_dir)
    
    tokenizer = AutoTokenizer.from_pretrained(args.model_id, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    
    # Load Data
    dataset = load_dataset("json", data_files={"test": args.eval_file})['test']
    
    predictions = []
    references = []
    inputs = []
    task_types = []
    
    print("Running inference...")
    for sample in tqdm(dataset):
        prompt = formatting.format_chat_template(
            formatting.SYSTEM_PROMPT,
            sample['input']
        )
        
        inputs.append(sample['input'])
        references.append(sample['target'])
        task_types.append(sample['task_type'])
        
        inputs_ids = tokenizer(prompt, return_tensors="pt").to(model.device)
        
        with torch.no_grad():
            outputs = model.generate(
                **inputs_ids,
                max_new_tokens=256,
                do_sample=False # Deterministic eval
            )
        
        # Decode only the new tokens
        response = tokenizer.decode(outputs[0][inputs_ids.input_ids.shape[1]:], skip_special_tokens=True)
        predictions.append(response)

    # Calculate Metrics
    results = metrics.calculate_metrics(predictions, references, inputs, task_types)
    
    print("\n--- Evaluation Results ---")
    print(json.dumps(results, indent=2))
    
    # Save results
    os.makedirs(args.output_dir, exist_ok=True)
    with open(os.path.join(args.output_dir, "eval_results.json"), "w") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_id", type=str, default="facebook/Meta-SecAlign-8B")
    parser.add_argument("--adapter_dir", type=str, default="outputs/secalign_lora")
    parser.add_argument("--eval_file", type=str, default=r"training/data/dataset_eval.jsonl")
    parser.add_argument("--output_dir", type=str, default="outputs/secalign_lora") # Save results in same dir
    
    args = parser.parse_args()
    evaluate(args)
