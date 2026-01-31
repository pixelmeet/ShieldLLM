
import os
import sys
import argparse
import torch
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import io, formatting

def train(args):
    print(f"Starting training for Primary Model: {args.model_id}")
    
    # 1. Load Model & Tokenizer
    model, tokenizer = io.load_model_and_tokenizer(args.model_id)
    
    # 2. Load Dataset
    data_files = {"train": args.train_file, "validation": args.eval_file}
    dataset = load_dataset("json", data_files=data_files)
    
    # 3. LoRA Configuration
    peft_config = io.get_lora_config(r=args.lora_r, alpha=args.lora_alpha, dropout=args.lora_dropout)
    
    # 4. Training Arguments
    # Optimized for 6GB VRAM: Valid batch size = 1, grad accumulation = 4 -> effective 4
    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=1, # Use max_steps instead usually, but 1 epoch is fine for small data
        max_steps=args.max_steps,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=4,
        learning_rate=args.lr,
        logging_steps=10,
        save_strategy="no", # Save manually at end to save space
        evaluation_strategy="steps",
        eval_steps=50,
        fp16=True, # Use Mixed Precision
        optim="paged_adamw_8bit", # Memory saver
        remove_unused_columns=False,
    )
    
    # 5. Formatting function
    def formatting_prompts_func(example):
        output_texts = []
        for i in range(len(example['input'])):
            text = formatting.format_chat_template(
                system_prompt=formatting.SYSTEM_PROMPT,
                user_message=example['input'][i],
                assistant_response=example['target'][i]
            )
            output_texts.append(text)
        return output_texts

    # 6. Trainer
    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset['train'],
        eval_dataset=dataset['validation'],
        peft_config=peft_config,
        max_seq_length=args.seq_len,
        tokenizer=tokenizer,
        args=training_args,
        formatting_func=formatting_prompts_func,
    )
    
    # 7. Train
    print("Training started...")
    trainer.train()
    
    # 8. Save
    print(f"Saving adapter to {args.output_dir}")
    trainer.model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_id", type=str, default="facebook/Meta-SecAlign-8B")
    parser.add_argument("--train_file", type=str, default=r"training/data/dataset_train.jsonl")
    parser.add_argument("--eval_file", type=str, default=r"training/data/dataset_eval.jsonl")
    parser.add_argument("--output_dir", type=str, default="outputs/secalign_lora")
    parser.add_argument("--max_steps", type=int, default=300) # Hackathon budget
    parser.add_argument("--batch_size", type=int, default=1)   # Must be 1 for 6GB VRAM on 8B model
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--lora_r", type=int, default=16)
    parser.add_argument("--lora_alpha", type=int, default=32)
    parser.add_argument("--lora_dropout", type=float, default=0.05)
    parser.add_argument("--seq_len", type=int, default=1024) # Reduced from 2048 for memory safety

    args = parser.parse_args()
    train(args)
