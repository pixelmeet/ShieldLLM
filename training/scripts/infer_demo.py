
import os
import sys
import argparse
import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

# Add parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import formatting

def demo(args):
    print("Loading model for demo...")
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
    
    if args.adapter_dir:
        print(f"Loading adapter from {args.adapter_dir}")
        model = PeftModel.from_pretrained(model, args.adapter_dir)
        
    tokenizer = AutoTokenizer.from_pretrained(args.model_id, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    
    print("\n" + "="*50)
    print(" SHIELD LLM DEFENSE DEMO ")
    print("="*50)
    print("Enter a prompt (or 'exit' to quit):")
    
    while True:
        user_input = input("\nUser: ")
        if user_input.lower() in ["exit", "quit"]:
            break
            
        prompt = formatting.format_chat_template(
            formatting.SYSTEM_PROMPT,
            user_input
        )
        
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=300,
                do_sample=True,
                temperature=0.7,
                top_p=0.9
            )
            
        response = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        
        print("\nShieldLLM:")
        print(response)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_id", type=str, default="facebook/Meta-SecAlign-8B")
    parser.add_argument("--adapter_dir", type=str, default="outputs/secalign_lora", help="Path to adapter. Leave empty for base model.")
    
    args = parser.parse_args()
    demo(args)
