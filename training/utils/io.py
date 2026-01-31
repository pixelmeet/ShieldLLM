
"""
Input/Output utilities for model saving and loading.
"""
import os
import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

def load_model_and_tokenizer(model_id, quantization=True):
    """
    Load model and tokenizer with optimized settings for limited VRAM.
    """
    print(f"Loading model: {model_id}...")
    
    bnb_config = None
    if quantization:
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=False,
        )

    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right" # Fix for fp16

    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True
    )

    # Enable gradient checkpointing for memory efficiency
    model.gradient_checkpointing_enable()
    
    # helper for PEFT
    model = prepare_model_for_kbit_training(model)
    
    return model, tokenizer

def get_lora_config(r=16, alpha=32, dropout=0.05):
    """
    Standard LoRA configuration for causal LM.
    """
    config = LoraConfig(
        r=r,
        lora_alpha=alpha,
        lora_dropout=dropout,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"] # Common targets
    )
    return config
