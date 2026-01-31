"use client";

import { useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, Loader, X, Copy, Check } from "lucide-react";
import { createWorker, type PSM } from "tesseract.js";

export interface OcrResult {
  text: string;
  confidence: number;
  processingTime: number;
  fileName: string;
  fileSize: number;
  timestamp: Date;
}

export interface OcrError {
  message: string;
  code:
    | "FILE_TOO_LARGE"
    | "INVALID_FORMAT"
    | "PROCESSING_ERROR"
    | "NETWORK_ERROR"
    | "UNKNOWN";
  details?: any;
}

export interface OcrProgress {
  status: "loading" | "recognizing" | "processing" | "complete";
  progress: number;
  message: string;
}

export interface OcrConfig {
  maxFileSize: number;
  acceptedFormats: string[];
  multipleFiles: boolean;

  language: string;
  oem: number;
  psm: number;

  showProgress: boolean;
  showConfidence: boolean;
  showProcessingTime: boolean;
  autoProcess: boolean;
  allowRetry: boolean;

  theme: "light" | "dark" | "auto";
  size: "sm" | "md" | "lg" | "xl";
  variant: "default" | "minimal" | "card" | "inline";

  customUploadArea?: ReactNode;
  customProgressView?: (progress: OcrProgress) => ReactNode;
  customResultView?: (
    result: OcrResult,
    onCopy: () => void,
    onDownload: () => void
  ) => ReactNode;
  customErrorView?: (error: OcrError, onRetry: () => void) => ReactNode;

  postProcessText: boolean;
  removeExtraSpaces: boolean;
  removeLineBreaks: boolean;
  toLowerCase: boolean;

  onFileSelect?: (file: File) => void;
  onFileReject?: (file: File, reason: string) => void;
  onProgress?: (progress: OcrProgress) => void;
  onComplete?: (result: OcrResult) => void;
  onError?: (error: OcrError) => void;
  onReset?: () => void;
}

export const defaultOcrConfig: OcrConfig = {
  maxFileSize: 10,
  acceptedFormats: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
  ],
  multipleFiles: false,

  language: "eng",
  oem: 1,
  psm: 3,

  showProgress: true,
  showConfidence: true,
  showProcessingTime: true,
  autoProcess: false,
  allowRetry: true,

  theme: "auto",
  size: "md",
  variant: "default",

  postProcessText: true,
  removeExtraSpaces: true,
  removeLineBreaks: false,
  toLowerCase: false,
};

export interface OcrComponentProps {
  config?: Partial<OcrConfig>;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  placeholder?: string;
  uploadText?: string;
  buttonText?: string;
  loadingText?: string;
  errorText?: string;
  successText?: string;
}

const processText = (text: string, config: OcrConfig): string => {
  let processedText = text;

  if (config.removeExtraSpaces) {
    processedText = processedText.replace(/\s+/g, " ").trim();
  }

  if (config.removeLineBreaks) {
    processedText = processedText.replace(/\n/g, " ");
  }

  if (config.toLowerCase) {
    processedText = processedText.toLowerCase();
  }

  return processedText;
};

const getSizeClasses = (size: OcrConfig["size"]) => {
  const sizes = {
    sm: "max-w-sm p-4",
    md: "max-w-2xl p-6",
    lg: "max-w-4xl p-8",
    xl: "max-w-6xl p-10",
  };
  return sizes[size];
};

const getThemeClasses = (theme: OcrConfig["theme"]) => {
  if (theme === "auto") {
    return "bg-white dark:bg-gray-900 text-gray-900 dark:text-white";
  }
  return theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900";
};

const DefaultUploadArea = ({
  config,
  onFileSelect,
  onDragOver,
  onDrop,
  uploadText,
}: {
  config: OcrConfig;
  onFileSelect: () => void;
  onDragOver: (e: any) => void;
  onDrop: (e: any) => void;
  uploadText?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className={`flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors duration-300 ${
      config.variant === "minimal" ? "p-4" : ""
    }`}
    onDrop={onDrop}
    onDragOver={onDragOver}
    onClick={onFileSelect}>
    <UploadCloud
      className={`text-gray-400 dark:text-gray-500 mb-4 ${
        config.size === "sm"
          ? "w-8 h-8"
          : config.size === "lg"
          ? "w-20 h-20"
          : config.size === "xl"
          ? "w-24 h-24"
          : "w-16 h-16"
      }`}
    />
    <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
      {uploadText || "Drag & drop an image here, or click to select"}
    </p>
    <p className="text-sm text-gray-400 dark:text-gray-500">
      Supported:{" "}
      {config.acceptedFormats
        .map((f) => f.split("/")[1].toUpperCase())
        .join(", ")}
    </p>
    <p className="text-sm text-gray-400 dark:text-gray-500">
      Max size: {config.maxFileSize}MB
    </p>
  </motion.div>
);

const DefaultProgressView = ({ progress }: { progress: OcrProgress }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="text-center p-6">
    <Loader className="w-12 h-12 mx-auto text-blue-500 mb-4 animate-spin" />
    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
      {progress.message}
    </h3>
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
      <motion.div
        className="bg-blue-600 h-2 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress.progress}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400">
      {progress.progress}% complete
    </p>
  </motion.div>
);

const DefaultResultView = ({
  result,
  onCopy,
  onDownload,
  config,
}: {
  result: OcrResult;
  onCopy: () => void;
  onDownload: () => void;
  config: OcrConfig;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 flex items-center">
          <FileText className="mr-2" />
          Extracted Text
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors"
            title="Copy to clipboard">
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </>
            )}
          </button>
          <button
            onClick={onDownload}
            className="flex items-center px-3 py-1 text-sm bg-blue-200 dark:bg-blue-700 hover:bg-blue-300 dark:hover:bg-blue-600 rounded-md transition-colors"
            title="Download as text file">
            <FileText className="w-4 h-4 mr-1" />
            Download
          </button>
        </div>
      </div>

      {config.showConfidence && (
        <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Confidence: {result.confidence.toFixed(1)}%
        </div>
      )}

      {config.showProcessingTime && (
        <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Processing time: {result.processingTime.toFixed(2)}s
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-600">
        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
          {result.text}
        </p>
      </div>
    </motion.div>
  );
};

const DefaultErrorView = ({
  error,
  onRetry,
  config,
}: {
  error: OcrError;
  onRetry: () => void;
  config: OcrConfig;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-red-800 dark:text-red-200 font-medium mb-1">
          {error.code
            .replace("_", " ")
            .toLowerCase()
            .replace(/\b\w/g, (l) => l.toUpperCase())}
        </h4>
        <p className="text-red-600 dark:text-red-400 text-sm">
          {error.message}
        </p>
      </div>
      {config.allowRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-md transition-colors">
          Retry
        </button>
      )}
    </div>
  </motion.div>
);

export function OcrComponent({
  config: userConfig = {},
  className = "",
  style,
  disabled = false,
  placeholder,
  uploadText,
  buttonText,
  loadingText,
  errorText,
  successText,
}: OcrComponentProps) {
  const config: OcrConfig = { ...defaultOcrConfig, ...userConfig };

  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [progress, setProgress] = useState<OcrProgress>({
    status: "loading",
    progress: 0,
    message: "Initializing...",
  });
  const [error, setError] = useState<OcrError | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    resetState();
  }, []);

  const resetState = () => {
    setImage(null);
    setResult(null);
    setProgress({ status: "loading", progress: 0, message: "Ready" });
    setError(null);
    setFileName("");
    setFileSize(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    config.onReset?.();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (file.size > config.maxFileSize * 1024 * 1024) {
      const error: OcrError = {
        message: `File size must be less than ${config.maxFileSize}MB`,
        code: "FILE_TOO_LARGE",
        details: {
          fileSize: file.size,
          maxSize: config.maxFileSize * 1024 * 1024,
        },
      };
      setError(error);
      config.onFileReject?.(file, error.message);
      config.onError?.(error);
      return;
    }

    if (!config.acceptedFormats.includes(file.type)) {
      const error: OcrError = {
        message: `File type not supported. Accepted formats: ${config.acceptedFormats.join(
          ", "
        )}`,
        code: "INVALID_FORMAT",
        details: {
          fileType: file.type,
          acceptedFormats: config.acceptedFormats,
        },
      };
      setError(error);
      config.onFileReject?.(file, error.message);
      config.onError?.(error);
      return;
    }

    setError(null);
    setFileName(file.name);
    setFileSize(file.size);
    config.onFileSelect?.(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
      if (config.autoProcess) {
        performOCR(reader.result as string, file);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const file = event.dataTransfer.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [config]
  );

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const performOCR = async (imageData?: string, file?: File) => {
    const imageToProcess = imageData || image;
    if (!imageToProcess) return;

    const startTime = Date.now();
    setProgress({
      status: "loading",
      progress: 0,
      message: "Loading OCR engine...",
    });
    config.onProgress?.(progress);

    try {
      const worker = await createWorker(config.language, config.oem, {
        logger: (m: { status: string; progress: number }) => {
          const newProgress: OcrProgress = {
            status:
              m.status === "recognizing text" ? "recognizing" : "processing",
            progress: Math.round(m.progress * 100),
            message:
              m.status === "recognizing text"
                ? "Extracting text..."
                : "Processing image...",
          };
          setProgress(newProgress);
          config.onProgress?.(newProgress);
        },
      });

      await worker.setParameters({
        tessedit_pageseg_mode: config.psm as unknown as PSM,
      });

      const {
        data: { text, confidence },
      } = await worker.recognize(imageToProcess);
      const processingTime = (Date.now() - startTime) / 1000;

      const processedText = config.postProcessText
        ? processText(text, config)
        : text;

      const ocrResult: OcrResult = {
        text: processedText,
        confidence,
        processingTime,
        fileName: fileName || file?.name || "unknown",
        fileSize: fileSize || file?.size || 0,
        timestamp: new Date(),
      };

      setResult(ocrResult);
      setProgress({ status: "complete", progress: 100, message: "Complete!" });
      config.onComplete?.(ocrResult);

      await worker.terminate();
    } catch (error) {
      const ocrError: OcrError = {
        message:
          error instanceof Error
            ? error.message
            : "Failed to extract text. Please try again with a clearer image.",
        code: "PROCESSING_ERROR",
        details: error,
      };
      setError(ocrError);
      config.onError?.(ocrError);
    }
  };

  const copyToClipboard = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  const downloadText = () => {
    if (!result) return;
    const blob = new Blob([result.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracted-text-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const retryOCR = () => {
    setError(null);
    performOCR();
  };

  const containerClasses = `
    ${getSizeClasses(config.size)} 
    ${getThemeClasses(config.theme)} 
    rounded-xl shadow-lg 
    ${
      config.variant === "minimal"
        ? "border border-gray-200 dark:border-gray-700"
        : ""
    }
    ${
      config.variant === "card"
        ? "border-2 border-gray-300 dark:border-gray-600"
        : ""
    }
    ${config.variant === "inline" ? "inline-block" : "w-full mx-auto"}
    ${className}
  `.trim();

  return (
    <div className={containerClasses} style={style}>
      {config.variant !== "minimal" && (
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            {placeholder || "Image to Text Converter"}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Upload an image to extract text using OCR technology
          </p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!image ? (
          config.customUploadArea || (
            <DefaultUploadArea
              config={config}
              onFileSelect={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              uploadText={uploadText}
            />
          )
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4">
            <div className="relative">
              <img
                src={image}
                alt="Preview"
                className="w-full h-auto max-h-96 object-contain rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <button
                onClick={resetState}
                className="absolute top-2 right-2 bg-white dark:bg-gray-800 rounded-full p-2 shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Remove image"
                disabled={disabled}>
                <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                File: {fileName} ({(fileSize / 1024 / 1024).toFixed(2)} MB)
              </p>

              {!result && !error && (
                <motion.button
                  onClick={() => performOCR()}
                  disabled={
                    disabled ||
                    progress.status === "recognizing" ||
                    progress.status === "processing"
                  }
                  className="px-8 py-3 font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}>
                  {progress.status === "recognizing" ||
                  progress.status === "processing" ? (
                    <div className="flex items-center">
                      <Loader className="animate-spin mr-2" />
                      {loadingText || progress.message}
                    </div>
                  ) : (
                    buttonText || "Extract Text"
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={config.acceptedFormats.join(",")}
        multiple={config.multipleFiles}
        className="hidden"
        disabled={disabled}
      />

      {/* Progress View */}
      {config.showProgress &&
        (progress.status === "recognizing" ||
          progress.status === "processing") &&
        (config.customProgressView ? (
          config.customProgressView(progress)
        ) : (
          <DefaultProgressView progress={progress} />
        ))}

      {/* Error View */}
      {error &&
        (config.customErrorView ? (
          config.customErrorView(error, retryOCR)
        ) : (
          <DefaultErrorView error={error} onRetry={retryOCR} config={config} />
        ))}

      {/* Result View */}
      {result &&
        (config.customResultView ? (
          config.customResultView(result, copyToClipboard, downloadText)
        ) : (
          <DefaultResultView
            result={result}
            onCopy={copyToClipboard}
            onDownload={downloadText}
            config={config}
          />
        ))}
    </div>
  );
}
