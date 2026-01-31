# Adversarial Prompt Injection Defense Training

This repository contains the fine-tuning pipeline for two models:
1. **Primary**: `facebook/Meta-SecAlign-8B`
2. **Shadow**: `microsoft/phi-4`

The goal is to defend against prompt injection attacks while maintaining utility on benign security tasks.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Build Dataset:
   ```bash
   python data/build_dataset.py
   ```
   This generates `data/dataset_train.jsonl` and `data/dataset_eval.jsonl`.

## Training

**Primary Model (SecAlign-8B):**
```bash
python scripts/train_primary.py --output_dir outputs/secalign_lora
```

**Shadow Model (Phi-4):**
```bash
python scripts/train_shadow.py --output_dir outputs/phi4_lora
```

## Evaluation

```bash
python scripts/eval_primary.py --model_id facebook/Meta-SecAlign-8B --adapter_dir outputs/secalign_lora
```

## Demo

```bash
python scripts/infer_demo.py --model_id facebook/Meta-SecAlign-8B --adapter_dir outputs/secalign_lora
```
