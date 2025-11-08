import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  presets: [presetUno(), presetAttributify(), presetIcons()],
  shortcuts: {
    // layout containers
    'app': 'relative text-slate-900 px-8 py-6 max-w-6xl mx-auto rounded-2xl bg-white/85 border border-slate-300/40 backdrop-blur-lg shadow-lg shadow-indigo-500/35 overflow-hidden',
    'app__header': 'flex flex-wrap justify-between gap-7 mb-12',
    'header__actions': 'flex flex-wrap gap-3 items-center',
    'app__content': 'grid gap-6',

    // panels
    'form-panel': 'p-6 rounded-xl bg-slate-50/95 border border-slate-300/40 shadow-inner',

    // header text
    'support-hint': 'inline-flex items-center gap-1 mt-3 px-3 py-2 rounded-lg bg-indigo-500/12 text-indigo-700 text-sm border border-indigo-500/20',

    // buttons
    'ghost-button': 'px-4 py-3 rounded-full border border-indigo-400/40 bg-white/80 text-violet-900 font-600 shadow-inner hover:(-translate-y-0.5 bg-indigo-500/8 border-indigo-400/60) transition-all',
    
    // analysis detail blocks（仅保留常用通用样式）
    'subtle': 'text-slate-400 mt-2',
    'error': 'm-0 px-4 py-3 rounded-lg bg-red-200/40 text-red-900 border border-red-300/60',
    

    // form
    'autofill-form': 'flex flex-col gap-4',
    'form-field': 'flex flex-col gap-2 p-3 rounded-xl bg-white/92 border border-slate-200/70 hover:(border-indigo-400/40 shadow-md) focus-within:(border-indigo-600/60 -translate-y-0.5 shadow-lg) transition-all',
    'field-hint': 'text-slate-500 text-sm',

    // pills
    'option-pill': 'border border-indigo-400/25 bg-indigo-500/8 text-indigo-900 px-3 py-1 rounded-full text-xs cursor-pointer transition-all hover:(border-indigo-400/55 bg-indigo-500/12 text-indigo-700)',
    'option-pill--active': 'bg-gradient-to-tr from-blue-400 to-indigo-500 text-white border-indigo-600/60 shadow-md shadow-indigo-600/50',

    // actions / groups 相关的快捷样式已移除（对应组件已删除）
    // highlight newly-filled fields in main form
    'agent-flash': 'ring-2 ring-emerald-400/60 bg-emerald-50/60 transition-colors',
    // floating assistant
    'floating-assistant': 'fixed right-6 bottom-6 z-50 flex flex-col items-end gap-2',
    // floating assistant toggle button (icon-only)
    'assistant-toggle': 'fixed right-6 bottom-6 z-50 h-14 w-14 rounded-full grid place-items-center bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-lg shadow-violet-500/40 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all',
    'assistant-toggle--open': 'from-violet-500 to-indigo-500 rotate-6',
    'assistant-dialog': 'fixed right-6 bottom-20 w-96 max-w-[92vw] max-h-[72vh] p-0 rounded-2xl bg-white/95 border border-slate-200/70 ring-1 ring-slate-200/60 shadow-2xl shadow-slate-900/10 backdrop-blur-xl grid grid-rows-[auto_1fr_auto] overflow-hidden transition-all duration-200 ease-out origin-bottom-right',
    'assistant-header': 'flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-slate-200/70',
    'assistant-close': 'px-2 py-1 rounded text-slate-600 hover:bg-slate-200/60 transition-colors',
    'chat-messages': 'overflow-y-auto p-3 space-y-2 bg-slate-50/70 text-sm scroll-smooth flex flex-col',
    'chat-row': 'w-full flex items-end gap-2',
    'chat-line': 'px-3 py-2 rounded-2xl whitespace-pre-wrap break-words max-w-[75%] shadow-sm',
    'chat-line--user': 'self-end bg-indigo-500 text-white shadow-indigo-500/20',
    'chat-line--assistant': 'self-start bg-white border border-slate-200/70 text-slate-900',
    'chat-meta': 'flex items-end gap-1 text-slate-500',
    'chat-avatar': 'w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs',
    'chat-time': 'text-[10px] ml-1',
    'chat-input': 'grid gap-2 p-3 bg-white border-t border-slate-200/70',
    // ChatGPT-like input bar
    'assistant-input-wrap': 'flex items-end gap-2 px-3 py-2 rounded-full bg-slate-900/5 border border-slate-300/60 shadow-inner',
    'assistant-textarea': 'flex-1 resize-none max-h-36 min-h-[1.75rem] leading-6 bg-transparent outline-none border-none px-1 py-0 text-slate-900 placeholder:(text-slate-400)',
    'assistant-circle': 'h-9 w-9 rounded-full flex items-center justify-center text-slate-600 bg-white/80 border border-slate-300/60 hover:(bg-slate-200/70) transition-colors',
    'assistant-circle--primary': 'bg-indigo-500 border-indigo-500 text-white hover:bg-indigo-600',
  },
})
