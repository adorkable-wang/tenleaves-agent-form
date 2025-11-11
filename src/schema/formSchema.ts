/**
 * 示例表单 Schema（中文注释版）
 * - 真实业务可按需扩展字段、同义词、描述、示例等
 */
import type { AgentFormField } from '../agent'

export const formSchema: AgentFormField[] = [
  {
    id: 'fullName',
    label: '姓名',
    synonyms: ['name', 'full name', 'applicant name', 'contact name', '姓名', '全名'],
    description: '申请人的中文或英文全名。',
  },
  {
    id: 'email',
    label: '邮箱地址',
    synonyms: ['email', 'mail', 'e-mail', '电子邮箱', '邮箱地址'],
    description: '主要的联系邮箱。',
  },
  {
    id: 'phone',
    label: '联系电话',
    synonyms: [
      'mobile',
      'telephone',
      'phone number',
      'contact number',
      '电话',
      '联系电话',
      '手机号',
    ],
    description: '方便联系的电话号码，若能提供区号更好。',
  },
  {
    id: 'company',
    label: '所在公司',
    synonyms: ['organization', 'employer', 'company name', 'company', '公司', '所在公司', '机构'],
    description: '文档中提到的公司或机构名称。',
  },
  {
    id: 'role',
    label: '职位 / 头衔',
    synonyms: ['job title', 'position', 'role', '职位', '头衔', '岗位'],
    description: '当前担任或目标申请的职位。',
  },
  {
    id: 'summary',
    label: '个人摘要',
    synonyms: ['profile summary', 'bio', 'overview', 'summary', '个人简介', '概要'],
    description: '结合文档信息生成的简介或亮点描述。',
  },
]
