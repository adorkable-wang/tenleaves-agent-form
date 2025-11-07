/**
 * DOM 侧表单快照工具（中文注释版）
 *
 * 作用：在“浏览器已渲染”的页面中，扫描 input/textarea/select 等控件，
 * 生成一份可读写的字段快照（选择器、标签、占位、是否必填、可选项……），
 * 并提供读取/写回方法，支持将智能体结果精确回填到真实控件。
 */

// 表示一个可选项（用于 select、radio、checkbox 组）
export type DomOption = { value: string; label?: string }

// 表示一个 DOM 字段的快照信息
export type DomFormField = {
  // 尽量稳定的标识：优先用 name 或 id，否则用选择器哈希
  stableId: string
  // 唯一 CSS 选择器：用于定位真实控件进行读/写
  domSelector: string
  name?: string
  idAttr?: string
  // 字段标签文本及其来源
  label?: string
  labelSource?: 'for' | 'closestLabel' | 'ariaLabel' | 'placeholder' | 'title'
  // 输入提示/描述文本
  placeholder?: string
  describedByText?: string
  // 控件类型与状态
  tagName: string
  inputType?: string
  required?: boolean
  disabled?: boolean
  multiple?: boolean
  // 可选项（select/radio/checkbox 组）
  options?: DomOption[]
  // 所属 form 与所在区块信息
  formSelector?: string
  sectionLabel?: string
}

// DOM 表单快照（可扩展）
export type DomFormSchema = {
  routeKey?: string
  signatureHash?: string
  fields: DomFormField[]
  metadata?: Record<string, unknown>
}

/**
 * 扫描页面中的 input/textarea/select，生成 DOM 字段快照
 * - 过滤隐藏/禁用控件
 * - 抽取 label/placeholder/aria 描述
 * - 生成唯一选择器 & 稳定 ID
 * - 收集 select/radio/checkbox 的可选项
 */
export function inferFormSchemaFromDOM(root: ParentNode = document): DomFormField[] {
  const nodes = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input,textarea,select'
    )
  )
  const fields: DomFormField[] = [] // 结果集合
  for (const el of nodes) {
    if (!isInteractable(el)) continue // 跳过不可交互
    const tagName = el.tagName // 标签名
    const inputType = (el as HTMLInputElement).type?.toLowerCase() // input 类型
    if (tagName === 'INPUT' && inputType === 'hidden') continue // 隐藏字段跳过

    const idAttr = (el as HTMLElement).id || undefined // 元素 id
    const name = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).name || undefined // name 属性
    const domSelector = buildUniqueSelector(el) // 构建唯一选择器
    const stableId = getStableId({ name, idAttr, domSelector }) // 生成稳定 ID

    const { label, source: labelSource } = getReadableLabel(el) // 字段标签
    const placeholder = (el as HTMLInputElement | HTMLTextAreaElement).placeholder || undefined // 占位
    const describedByText = getAriaDescribedByText(el) || undefined // aria 描述

    const required = !!(
      (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).required
    )
    const disabled = !!(
      (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).disabled
    )
    const multiple = (el as HTMLSelectElement).multiple ?? false // select 是否多选

    const options = extractOptions(el, inputType) // 可选项
    const formSelector = getFormSelector(el) // 所属 form
    const sectionLabel = getSectionLabel(el) // 所在区块标题

    fields.push({
      stableId,
      domSelector,
      name,
      idAttr,
      label,
      labelSource,
      placeholder,
      describedByText,
      tagName,
      inputType,
      required,
      disabled,
      multiple,
      options,
      formSelector,
      sectionLabel,
    })
  }
  return fields
}

/**
 * 读取映射到真实控件的当前值
 * - 按 mapping(appId -> selector) 找控件
 * - 针对不同类型分别读取（select/radio/checkbox/textarea/input）
 */
export function readFormValuesFromDOM(
  root: ParentNode,
  mapping: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [fieldId, selector] of Object.entries(mapping)) {
    const el = root.querySelector(selector) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null
    if (!el) continue
    const tag = el.tagName
    const type = (el as HTMLInputElement).type?.toLowerCase()
    if (tag === 'SELECT') {
      const sel = el as HTMLSelectElement
      if (sel.multiple) {
        const values = Array.from(sel.selectedOptions).map((o) => o.value)
        result[fieldId] = values.join(',')
      } else {
        result[fieldId] = sel.value ?? ''
      }
      continue
    }
    if (tag === 'TEXTAREA') {
      result[fieldId] = (el as HTMLTextAreaElement).value ?? ''
      continue
    }
    if (tag === 'INPUT') {
      const input = el as HTMLInputElement
      if (type === 'checkbox') {
        result[fieldId] = input.checked ? input.value || 'on' : ''
        continue
      }
      if (type === 'radio') {
        if (input.name) {
          const checked = root.querySelector<HTMLInputElement>(
            `input[type="radio"][name="${CSS.escape(input.name)}"]:checked`
          )
          result[fieldId] = checked?.value ?? ''
        } else {
          result[fieldId] = input.checked ? input.value : ''
        }
        continue
      }
      result[fieldId] = input.value ?? ''
      continue
    }
  }
  return result
}

/**
 * 将 values 写回真实控件
 * - 定位控件
 * - 针对不同类型分别写入并触发 input/change 事件，保证框架/校验能响应
 */
export function applyValuesToDOM(
  root: ParentNode,
  values: Record<string, string>,
  mapping: Record<string, string>
): void {
  for (const [fieldId, value] of Object.entries(values)) {
    const selector = mapping[fieldId]
    if (!selector) continue
    const el = root.querySelector(selector) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null
    if (!el) continue
    const tag = el.tagName
    const type = (el as HTMLInputElement).type?.toLowerCase()
    if (tag === 'SELECT') {
      const sel = el as HTMLSelectElement
      if (sel.multiple) {
        const set = new Set(value.split(',').map((v) => v.trim()))
        for (const opt of Array.from(sel.options)) {
          opt.selected = set.has(opt.value)
        }
      } else {
        sel.value = value
      }
      dispatchInputEvents(sel)
      continue
    }
    if (tag === 'TEXTAREA') {
      ;(el as HTMLTextAreaElement).value = value
      dispatchInputEvents(el)
      continue
    }
    if (tag === 'INPUT') {
      const input = el as HTMLInputElement
      if (type === 'checkbox') {
        input.checked = Boolean(value)
        dispatchInputEvents(input)
        continue
      }
      if (type === 'radio') {
        if (input.name) {
          const radios = root.querySelectorAll<HTMLInputElement>(
            `input[type="radio"][name="${CSS.escape(input.name)}"]`
          )
          radios.forEach((node) => {
            node.checked = node.value === value
            if (node === input) dispatchInputEvents(node)
          })
        } else {
          input.checked = input.value === value
          dispatchInputEvents(input)
        }
        continue
      }
      input.value = value
      dispatchInputEvents(input)
      continue
    }
  }
}

/**
 * 将映射缓存到 localStorage（browser only）
 */
export function persistMapping(key: string, mapping: Record<string, string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`agent_mapping:${key}`, JSON.stringify(mapping))
  } catch {
    // 忽略
  }
}

/**
 * 从 localStorage 读取映射（browser only）
 */
export function loadMapping(key: string): Record<string, string> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`agent_mapping:${key}`)
    return raw ? (JSON.parse(raw) as Record<string, string>) : null
  } catch {
    return null
  }
}

// 判断元素是否可交互（可见、非 disabled、尺寸非 0）
function isInteractable(el: Element): boolean {
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  const rect = (el as HTMLElement).getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false
  if ((el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).disabled) return false
  return true
}

// 提取“最合理”的标签文本（按 for/最近 label/aria/placeholder/title 顺序）
function getReadableLabel(
  el: Element
): { label?: string; source?: DomFormField['labelSource'] } {
  const id = (el as HTMLElement).id
  if (id) {
    const byFor = el.ownerDocument?.querySelector<HTMLLabelElement>(
      `label[for="${CSS.escape(id)}"]`
    )
    if (byFor?.textContent?.trim())
      return { label: byFor.textContent.trim(), source: 'for' }
  }
  const closestLabel = el.closest('label')
  if (closestLabel?.textContent?.trim())
    return { label: closestLabel.textContent.trim(), source: 'closestLabel' }
  const aria = (el as HTMLElement).getAttribute('aria-label')
  if (aria?.trim()) return { label: aria.trim(), source: 'ariaLabel' }
  const placeholder = (el as HTMLInputElement | HTMLTextAreaElement).placeholder
  if (placeholder?.trim()) return { label: placeholder.trim(), source: 'placeholder' }
  const title = (el as HTMLElement).getAttribute('title')
  if (title?.trim()) return { label: title.trim(), source: 'title' }
  return {}
}

// 根据 aria-describedby 引用，拼接描述文本
function getAriaDescribedByText(el: Element): string {
  const ids =
    (el as HTMLElement)
      .getAttribute('aria-describedby')
      ?.split(/\s+/)
      .filter(Boolean) ?? []
  const texts = ids
    .map((id) => el.ownerDocument?.getElementById(id)?.textContent?.trim())
    .filter(Boolean) as string[]
  return texts.join(' ')
}

// 抽取可选项：select 的 option，或 radio/checkbox 的同组 input
function extractOptions(el: Element, inputType?: string): DomOption[] | undefined {
  if (el.tagName === 'SELECT') {
    const sel = el as HTMLSelectElement
    return Array.from(sel.options).map((o) => ({
      value: o.value,
      label: o.textContent ?? undefined,
    }))
  }
  if (el.tagName === 'INPUT' && (inputType === 'radio' || inputType === 'checkbox')) {
    const name = (el as HTMLInputElement).name
    if (!name) return undefined
    const group = el.ownerDocument?.querySelectorAll<HTMLInputElement>(
      `input[type="${inputType}"][name="${CSS.escape(name)}"]`
    )
    return Array.from(group ?? []).map((node) => {
      const lab = getReadableLabel(node).label
      return { value: node.value, label: lab }
    })
  }
  return undefined
}

// 生成所属 form 的简短选择器（优先 id/name）
function getFormSelector(el: Element): string | undefined {
  const form = (el as HTMLInputElement).form
  if (!form) return undefined
  if (form.id) return `form#${CSS.escape(form.id)}`
  const name = form.getAttribute('name')
  if (name) return `form[name="${CSS.escape(name)}"]`
  return 'form'
}

// 寻找最近的字段集/卡片标题用于分组提示
function getSectionLabel(el: Element): string | undefined {
  const fieldset = el.closest('fieldset')
  const legend = fieldset?.querySelector('legend')?.textContent?.trim()
  if (legend) return legend
  const sectionHeading = el
    .closest('[role="group"], section, .card, .panel')
    ?.querySelector('h1,h2,h3,h4,h5')
    ?.textContent?.trim()
  return sectionHeading || undefined
}

/**
 * 构建唯一 CSS 选择器（尽量短）：
 * 1) 有 id 直接用
 * 2) 有唯一 name 则用 tag[name="..."]
 * 3) 否则向上拼接 nth-of-type，直到遇到父级 id
 */
export function buildUniqueSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`
  const name = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).name
  if (name) {
    const base = `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`
    const all = el.ownerDocument?.querySelectorAll(base)
    if (all && all.length === 1) return base
  }
  const parts: string[] = []
  let node: Element | null = el
  while (node && node.nodeType === 1 && node !== document.body) {
    const parentEl: Element | null = node.parentElement
    if (!parentEl) break
    const tag = node.tagName.toLowerCase()
    const siblings = Array.from(parentEl.children).filter(
      (n): n is Element => (n as Element).tagName === node!.tagName
    )
    const index = siblings.indexOf(node) + 1
    parts.unshift(`${tag}:nth-of-type(${index})`)
    node = parentEl
    if (node && (node as HTMLElement).id) {
      parts.unshift(`#${CSS.escape((node as HTMLElement).id)}`)
      break
    }
  }
  return parts.join(' > ')
}

// 生成稳定 ID：name > id > 选择器哈希
export function getStableId(input: {
  name?: string
  idAttr?: string
  domSelector: string
}): string {
  if (input.name) return input.name
  if (input.idAttr) return input.idAttr
  return 'f_' + simpleHash(input.domSelector)
}

// 简单字符串哈希（稳定即可，不要求加密强度）
function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

// 派发 input/change 事件，保证框架 & 校验能响应到值变更
function dispatchInputEvents(el: Element) {
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}
