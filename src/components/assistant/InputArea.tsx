import React from "react";
import {
  ACCEPT_ATTRIBUTE_VALUE,
  SUPPORTED_FORMAT_LABEL,
} from "../../utils/fileParser";

interface AssistantInputAreaProps {
  pending: boolean;
  pendingFile: File | null;
  inputText: string;
  dragActive: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onPaste: React.ClipboardEventHandler<HTMLTextAreaElement>;
  onDrop: React.DragEventHandler<HTMLTextAreaElement>;
  onDragOver: React.DragEventHandler<HTMLTextAreaElement>;
  onDragLeave: () => void;
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onSelectFileClick: () => void;
  onFileChange: React.ChangeEventHandler<HTMLInputElement>;
  onRemoveFile: () => void;
  onSubmit: () => void;
}

export function AssistantInputArea({
  pending,
  pendingFile,
  inputText,
  dragActive,
  textareaRef,
  fileInputRef,
  onInputChange,
  onPaste,
  onDrop,
  onDragOver,
  onDragLeave,
  onKeyDown,
  onSelectFileClick,
  onFileChange,
  onRemoveFile,
  onSubmit,
}: AssistantInputAreaProps) {
  return (
    <div className="chat-input">
      {pendingFile ? (
        <div className="mb-2 text-xs text-slate-700">
          已选择文件：<strong>{pendingFile.name}</strong>
          <button
            type="button"
            className="ml-2 text-indigo-700 underline"
            onClick={onRemoveFile}
          >
            移除
          </button>
        </div>
      ) : null}
      <div
        className={`assistant-input-wrap ${
          dragActive ? "ring-3 ring-indigo-400/45 border-indigo-400/60" : ""
        }`}
        aria-busy={pending}
      >
        <button
          type="button"
          className="assistant-circle"
          title="添加内容或选择文件"
          onClick={onSelectFileClick}
          disabled={pending}
          aria-label="添加"
        >
          <span className="i-material-symbols-add-rounded text-lg" />
        </button>
        <textarea
          ref={textareaRef}
          className="assistant-textarea"
          rows={1}
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={`输入你的问题，或将文件粘贴/拖拽到这里（支持 ${SUPPORTED_FORMAT_LABEL}）`}
          onPaste={onPaste}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={(e) => {
            e.preventDefault();
            onDragLeave();
          }}
          onKeyDown={onKeyDown}
          disabled={pending}
        />
        {dragActive ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-white/90 px-4 py-1 text-xs text-indigo-600 shadow">
              松开即可上传
            </span>
          </div>
        ) : null}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept={ACCEPT_ATTRIBUTE_VALUE}
          onChange={(e) => {
            onFileChange(e);
            e.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          className="assistant-circle assistant-circle--primary"
          title="提交分析"
          onClick={onSubmit}
          disabled={pending}
          aria-label="发送"
        >
          {pending ? (
            <span className="i-line-md:loading-twotone-loop text-white text-lg" />
          ) : (
            <span className="i-material-symbols-send-rounded text-white text-lg" />
          )}
        </button>
      </div>
    </div>
  );
}

export default AssistantInputArea;
