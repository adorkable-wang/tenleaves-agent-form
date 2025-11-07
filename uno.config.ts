import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  presets: [presetUno(), presetAttributify(), presetIcons()],
  shortcuts: {
    // layout containers
    'app': 'relative text-slate-900 px-8 py-6 max-w-6xl mx-auto rounded-2xl bg-white/85 border border-slate-300/40 backdrop-blur-lg shadow-lg shadow-indigo-500/35 overflow-hidden',
    'app__header': 'flex flex-wrap justify-between gap-7 mb-12',
    'header__actions': 'flex flex-wrap gap-3 items-center',
    'app__content': 'grid gap-6 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]',

    // panels
    'analysis-panel': 'p-6 rounded-xl bg-slate-50/95 border border-slate-300/40 shadow-inner',
    'form-panel': 'p-6 rounded-xl bg-slate-50/95 border border-slate-300/40 shadow-inner',
    'analysis-panel__status': 'flex flex-wrap gap-2 md:gap-4 items-center mb-4 text-slate-700 text-sm px-4 py-3 rounded-xl bg-slate-200/60 border border-slate-300/50',

    // header text
    'support-hint': 'inline-flex items-center gap-1 mt-3 px-3 py-2 rounded-lg bg-indigo-500/12 text-indigo-700 text-sm border border-indigo-500/20',
    'status-format': 'px-2 py-1 rounded bg-blue-500/10 text-blue-700 text-xs font-600',

    // buttons
    'file-input': 'relative inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-600 text-white bg-gradient-to-tr from-blue-400 to-indigo-500 shadow-md shadow-indigo-500/50 hover:-translate-y-0.5 hover:shadow-lg transition-all',
    'ghost-button': 'px-4 py-3 rounded-full border border-indigo-400/40 bg-white/80 text-violet-900 font-600 shadow-inner hover:(-translate-y-0.5 bg-indigo-500/8 border-indigo-400/60) transition-all',

    // status badges
    'status': 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-600 tracking-wider uppercase',
    'status--idle': 'bg-slate-200/85 text-slate-900',
    'status--loading': 'bg-yellow-300/30 text-amber-900 ring-1 ring-amber-300/50 animate-pulse',
    'status--error': 'bg-red-400/30 text-red-900 ring-1 ring-red-400/50',
    'status--success': 'bg-emerald-400/30 text-emerald-800 ring-1 ring-emerald-400/50',

    // progress bar
    'progress-bar': 'relative w-full h-1.5 my-3 rounded-full bg-slate-300/40 overflow-hidden focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-400/35',
    'progress-bar__indicator': 'absolute inset-0 h-full rounded-inherit bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-300 ease-in-out',

    // analysis detail blocks
    'analysis-details': 'mt-5 pt-4 border-t border-dashed border-slate-300/60 grid gap-2 text-slate-800',
    'parser-notes': 'm-0 px-4 py-3 rounded-xl list-none bg-indigo-500/8 text-indigo-800 border border-indigo-500/20',
    'subtle': 'text-slate-400 mt-2',
    'error': 'm-0 px-4 py-3 rounded-lg bg-red-200/40 text-red-900 border border-red-300/60',
    'diagnostics': 'mt-2 pl-5 text-slate-600',

    // recognized output
    'recognized-output': 'mt-4 p-4 rounded-xl bg-blue-50/90 border border-blue-300/40 grid gap-3',
    'recognized-grid': 'grid gap-3',
    'recognized-item': 'grid gap-1 p-3 rounded-lg bg-white/85 border border-blue-200/70',
    'recognized-label': 'font-600 text-slate-800',
    'recognized-value': 'text-slate-900 break-words',
    'recognized-confidence': 'text-blue-600 text-xs',
    'recognized-options': 'flex flex-wrap gap-2 mt-1',

    // extracted pairs
    'extracted-pairs': 'rounded-lg border border-slate-300/40 bg-slate-50/80 px-3 py-2',

    // form
    'autofill-form': 'flex flex-col gap-4',
    'form-field': 'flex flex-col gap-2 p-3 rounded-xl bg-white/92 border border-slate-200/70 hover:(border-indigo-400/40 shadow-md) focus-within:(border-indigo-600/60 -translate-y-0.5 shadow-lg) transition-all',
    'field-hint': 'text-slate-500 text-sm',

    // pills
    'option-pill': 'border border-indigo-400/25 bg-indigo-500/8 text-indigo-900 px-3 py-1 rounded-full text-xs cursor-pointer transition-all hover:(border-indigo-400/55 bg-indigo-500/12 text-indigo-700)',
    'option-pill--active': 'bg-gradient-to-tr from-blue-400 to-indigo-500 text-white border-indigo-600/60 shadow-md shadow-indigo-600/50',

    // actions
    'action-panel': 'mt-4 px-4 py-3 rounded-xl bg-teal-500/12 border border-teal-500/25',
    'action-pill': 'border border-teal-600/25 bg-teal-400/12 text-teal-800 px-3 py-1 rounded-full text-xs cursor-pointer hover:(border-teal-600/45 bg-teal-400/20 text-teal-900) transition-all',
    'action-rationale': 'mt-1 text-sm text-slate-700',

    // groups
    'group-selector': 'mt-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20',
    'group-selector__pills': 'flex flex-wrap gap-2',
    'group-pill': 'border border-emerald-600/25 bg-emerald-400/16 text-emerald-800 px-3 py-1 rounded-full text-xs cursor-pointer hover:(border-emerald-600/45 bg-emerald-400/24 text-emerald-900)',
    'group-pill--active': 'bg-gradient-to-tr from-emerald-400 to-teal-500 text-white border-emerald-600/60 shadow-md shadow-emerald-600/50',
    'group-hint': 'mt-2 text-sm text-emerald-800',
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
    'chat-line--system': 'bg-slate-300/30 text-slate-900 border border-slate-400/30',
    'chat-input': 'grid gap-2 p-3 bg-white border-t border-slate-200/70',
    'chat-input__row': 'flex items-center justify-between gap-2',
    // ChatGPT-like input bar
    'assistant-input-wrap': 'flex items-end gap-2 px-3 py-2 rounded-full bg-slate-900/5 border border-slate-300/60 shadow-inner',
    'assistant-textarea': 'flex-1 resize-none max-h-36 min-h-[1.75rem] leading-6 bg-transparent outline-none border-none px-1 py-0 text-slate-900 placeholder:(text-slate-400)',
    'assistant-circle': 'h-9 w-9 rounded-full flex items-center justify-center text-slate-600 bg-white/80 border border-slate-300/60 hover:(bg-slate-200/70) transition-colors',
    'assistant-circle--primary': 'bg-indigo-500 border-indigo-500 text-white hover:bg-indigo-600',
  },
})
