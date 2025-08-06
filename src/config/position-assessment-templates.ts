// 🎯 岗位评估模板配置
// 根据不同岗位提供针对性的评估维度和权重

export interface AssessmentDimension {
  name: string;
  description: string;
  weight: number; // 权重 (0-1)
  evaluationCriteria: string[];
}

export interface PositionTemplate {
  position: string;
  category: string;
  displayName: string;
  description: string;
  professionalDimensions: AssessmentDimension[];
  personalDimensions: AssessmentDimension[];
}

// 🏢 岗位评估模板定义
export const POSITION_ASSESSMENT_TEMPLATES: PositionTemplate[] = [
  // 软件产品经理（TP-Link特化）
  {
    position: "product_manager_software",
    category: "product",
    displayName: "产品经理（软件）",
    description: "负责TP-Link软件产品（如APP、路由器管理界面、云服务）的规划、设计和管理",
    professionalDimensions: [
      {
        name: "软件产品设计",
        description: "网络设备软件产品（APP、管理界面、云服务）的设计和规划能力",
        weight: 0.3,
        evaluationCriteria: [
          "TP-Link APP产品体验理解",
          "路由器管理界面设计思路",
          "网络设备软件交互逻辑",
          "用户场景分析能力",
          "软件产品功能规划"
        ]
      },
      {
        name: "项目管理",
        description: "跨部门协调和项目推进能力",
        weight: 0.25,
        evaluationCriteria: [
          "跨部门协调能力",
          "项目规划和执行",
          "资源调配能力",
          "风险识别和处理",
          "进度控制能力"
        ]
      },
      {
        name: "数据分析",
        description: "基于数据进行决策和优化的能力",
        weight: 0.2,
        evaluationCriteria: [
          "数据分析思维",
          "KPI指标理解",
          "A/B测试经验",
          "用户行为分析",
          "业务数据解读"
        ]
      },
      {
        name: "网络技术理解",
        description: "对网络设备技术和软硬件结合的理解",
        weight: 0.15,
        evaluationCriteria: [
          "路由器/交换机基础技术理解",
          "网络协议基础知识",
          "软硬件结合产品理解",
          "技术可行性评估",
          "与研发团队协作能力"
        ]
      },
      {
        name: "行业洞察",
        description: "对网络设备行业和TP-Link市场地位的理解",
        weight: 0.1,
        evaluationCriteria: [
          "网络设备行业趋势理解",
          "TP-Link品牌定位认知",
          "竞争对手产品分析",
          "用户群体特征理解",
          "市场机会识别"
        ]
      }
    ],
    personalDimensions: [
      {
        name: "沟通协调",
        description: "跨团队沟通和协调能力",
        weight: 0.3,
        evaluationCriteria: [
          "表达清晰度",
          "倾听理解能力",
          "冲突处理能力",
          "影响力建设",
          "团队合作精神"
        ]
      },
      {
        name: "学习适应",
        description: "快速学习和适应变化的能力",
        weight: 0.25,
        evaluationCriteria: [
          "学习新知识的速度",
          "适应变化的能力",
          "持续改进意识",
          "反思总结能力",
          "创新思维"
        ]
      },
      {
        name: "抗压能力",
        description: "在压力下保持高效工作的能力",
        weight: 0.2,
        evaluationCriteria: [
          "压力承受能力",
          "情绪管理能力",
          "工作优先级管理",
          "危机处理能力",
          "持续动力"
        ]
      },
      {
        name: "逻辑思维",
        description: "系统性思考和问题解决能力",
        weight: 0.15,
        evaluationCriteria: [
          "逻辑分析能力",
          "系统性思考",
          "问题分解能力",
          "决策制定过程",
          "批判性思维"
        ]
      },
      {
        name: "责任心",
        description: "对工作结果的责任感和主动性",
        weight: 0.1,
        evaluationCriteria: [
          "工作主动性",
          "结果导向意识",
          "责任承担态度",
          "质量意识",
          "自我驱动力"
        ]
      }
    ]
  },

  // 硬件产品经理（TP-Link特化）
  {
    position: "product_manager_hardware",
    category: "product",
    displayName: "产品经理（硬件）",
    description: "负责TP-Link硬件产品（如路由器、交换机、网卡等）的规划、设计和管理",
    professionalDimensions: [
      {
        name: "硬件产品设计",
        description: "网络硬件设备的产品规划和设计能力",
        weight: 0.3,
        evaluationCriteria: [
          "路由器/交换机产品理解",
          "硬件规格定义能力",
          "产品差异化设计思路",
          "成本控制意识",
          "产品线规划能力"
        ]
      },
      {
        name: "技术架构理解",
        description: "对网络设备硬件架构和技术的深度理解",
        weight: 0.25,
        evaluationCriteria: [
          "网络芯片和处理器选择",
          "射频和天线设计理解",
          "硬件性能优化理解",
          "制造工艺和供应链理解",
          "技术发展趋势把握"
        ]
      },
      {
        name: "市场竞争分析",
        description: "对网络设备市场和竞争格局的分析能力",
        weight: 0.2,
        evaluationCriteria: [
          "主要竞争对手产品分析",
          "价格策略制定能力",
          "目标用户群体定位",
          "销售渠道理解",
          "市场趋势预判"
        ]
      },
      {
        name: "供应链管理",
        description: "硬件产品供应链和生产管理的基础理解",
        weight: 0.15,
        evaluationCriteria: [
          "元器件供应商管理",
          "生产成本控制",
          "质量管理体系理解",
          "库存管理策略",
          "风险控制意识"
        ]
      },
      {
        name: "法规合规",
        description: "网络设备相关法规和认证要求的理解",
        weight: 0.1,
        evaluationCriteria: [
          "FCC/CE等认证要求理解",
          "各国网络设备法规认知",
          "安全标准和协议理解",
          "环保要求和RoHS合规",
          "专利风险识别"
        ]
      }
    ],
    personalDimensions: [
      {
        name: "沟通协调",
        description: "跨团队沟通和协调能力",
        weight: 0.3,
        evaluationCriteria: [
          "与研发团队协作",
          "供应商沟通能力",
          "销售团队配合",
          "跨部门协调能力",
          "项目推进能力"
        ]
      },
      {
        name: "逻辑思维",
        description: "系统性分析和问题解决能力",
        weight: 0.25,
        evaluationCriteria: [
          "复杂问题分析能力",
          "数据驱动决策",
          "成本效益分析",
          "风险评估能力",
          "战略思维"
        ]
      },
      {
        name: "学习适应",
        description: "快速学习新技术和适应变化的能力",
        weight: 0.2,
        evaluationCriteria: [
          "新技术学习速度",
          "行业变化适应能力",
          "持续改进意识",
          "创新思维",
          "知识整合能力"
        ]
      },
      {
        name: "抗压能力",
        description: "在压力和挑战下保持高效的能力",
        weight: 0.15,
        evaluationCriteria: [
          "项目压力处理",
          "多任务管理",
          "deadline管理",
          "突发问题应对",
          "情绪管理能力"
        ]
      },
      {
        name: "责任心",
        description: "对产品和工作结果的责任感",
        weight: 0.1,
        evaluationCriteria: [
          "产品质量意识",
          "用户体验关注",
          "工作主动性",
          "结果导向",
          "持续跟进能力"
        ]
      }
    ]
  },

  // 技术开发类
  {
    position: "software_engineer",
    category: "technology",
    displayName: "软件工程师",
    description: "负责软件开发、架构设计和技术实现",
    professionalDimensions: [
      {
        name: "编程能力",
        description: "代码编写、算法设计和技术实现能力",
        weight: 0.35,
        evaluationCriteria: [
          "编程语言掌握程度",
          "算法和数据结构",
          "代码质量意识",
          "调试和问题解决",
          "编程最佳实践"
        ]
      },
      {
        name: "系统设计",
        description: "系统架构和技术方案设计能力",
        weight: 0.25,
        evaluationCriteria: [
          "架构设计思维",
          "技术选型能力",
          "扩展性考虑",
          "性能优化意识",
          "安全性考虑"
        ]
      },
      {
        name: "技术深度",
        description: "在特定技术领域的专业深度",
        weight: 0.2,
        evaluationCriteria: [
          "专业领域深度",
          "技术原理理解",
          "源码阅读能力",
          "技术细节把控",
          "技术前沿关注"
        ]
      },
      {
        name: "工程实践",
        description: "软件工程和开发流程的实践能力",
        weight: 0.15,
        evaluationCriteria: [
          "版本控制使用",
          "测试驱动开发",
          "代码审查参与",
          "CI/CD流程理解",
          "文档编写习惯"
        ]
      },
      {
        name: "问题解决",
        description: "技术问题分析和解决能力",
        weight: 0.05,
        evaluationCriteria: [
          "问题定位能力",
          "根因分析思路",
          "解决方案评估",
          "故障排查经验",
          "预防性思维"
        ]
      }
    ],
    personalDimensions: [
      {
        name: "学习能力",
        description: "持续学习新技术的能力和动力",
        weight: 0.25,
        evaluationCriteria: [
          "新技术学习速度",
          "技术热情度",
          "知识分享意愿",
          "技术社区参与",
          "持续改进意识"
        ]
      },
      {
        name: "团队协作",
        description: "与团队成员协作和知识共享",
        weight: 0.25,
        evaluationCriteria: [
          "代码协作能力",
          "技术讨论参与",
          "知识分享习惯",
          "团队规范遵循",
          "互助精神"
        ]
      },
      {
        name: "逻辑思维",
        description: "逻辑分析和抽象思维能力",
        weight: 0.2,
        evaluationCriteria: [
          "逻辑分析能力",
          "抽象思维能力",
          "系统性思考",
          "模式识别能力",
          "复杂问题分解"
        ]
      },
      {
        name: "沟通表达",
        description: "技术沟通和需求理解能力",
        weight: 0.15,
        evaluationCriteria: [
          "技术方案表达",
          "需求理解准确性",
          "跨部门沟通",
          "文档表达能力",
          "用户思维"
        ]
      },
      {
        name: "自驱力",
        description: "主动性和自我管理能力",
        weight: 0.15,
        evaluationCriteria: [
          "工作主动性",
          "自我管理能力",
          "目标导向意识",
          "时间管理能力",
          "持续优化动力"
        ]
      }
    ]
  },

  // 销售类
  {
    position: "sales",
    category: "business",
    displayName: "销售代表",
    description: "负责客户开发、关系维护和销售业绩达成",
    professionalDimensions: [
      {
        name: "销售技巧",
        description: "客户沟通、需求挖掘和成交技巧",
        weight: 0.3,
        evaluationCriteria: [
          "客户沟通技巧",
          "需求挖掘能力",
          "产品介绍能力",
          "异议处理技巧",
          "成交促进能力"
        ]
      },
      {
        name: "客户管理",
        description: "客户关系建立和维护能力",
        weight: 0.25,
        evaluationCriteria: [
          "客户关系建立",
          "客户需求理解",
          "客户满意度管理",
          "长期关系维护",
          "客户价值挖掘"
        ]
      },
      {
        name: "市场理解",
        description: "对市场环境和竞争态势的理解",
        weight: 0.2,
        evaluationCriteria: [
          "市场环境分析",
          "竞争对手了解",
          "行业趋势把握",
          "客户群体特征",
          "价格策略理解"
        ]
      },
      {
        name: "目标管理",
        description: "销售目标规划和执行能力",
        weight: 0.15,
        evaluationCriteria: [
          "目标制定能力",
          "销售计划执行",
          "业绩达成意识",
          "资源配置能力",
          "效率提升方法"
        ]
      },
      {
        name: "产品知识",
        description: "对产品特性和价值的掌握程度",
        weight: 0.1,
        evaluationCriteria: [
          "产品功能理解",
          "价值主张表达",
          "技术细节掌握",
          "应用场景理解",
          "差异化优势"
        ]
      }
    ],
    personalDimensions: [
      {
        name: "沟通能力",
        description: "语言表达和人际交往能力",
        weight: 0.3,
        evaluationCriteria: [
          "语言表达能力",
          "倾听理解能力",
          "人际交往技巧",
          "情商表现",
          "说服影响力"
        ]
      },
      {
        name: "抗压韧性",
        description: "面对挫折和压力的恢复能力",
        weight: 0.25,
        evaluationCriteria: [
          "挫折承受能力",
          "压力管理能力",
          "恢复速度",
          "持续动力",
          "乐观态度"
        ]
      },
      {
        name: "主动积极",
        description: "工作主动性和积极性",
        weight: 0.2,
        evaluationCriteria: [
          "工作主动性",
          "机会敏感度",
          "执行积极性",
          "自我驱动力",
          "创新意识"
        ]
      },
      {
        name: "诚信可靠",
        description: "诚信度和可靠性",
        weight: 0.15,
        evaluationCriteria: [
          "诚信度表现",
          "承诺履行能力",
          "责任心",
          "专业形象",
          "信任建立"
        ]
      },
      {
        name: "学习适应",
        description: "学习新知识和适应变化的能力",
        weight: 0.1,
        evaluationCriteria: [
          "学习新产品速度",
          "市场变化适应",
          "客户需求洞察",
          "销售方法改进",
          "持续提升意识"
        ]
      }
    ]
  },

  // 设计类
  {
    position: "designer",
    category: "design",
    displayName: "设计师",
    description: "负责产品界面、用户体验和视觉设计",
    professionalDimensions: [
      {
        name: "设计能力",
        description: "视觉设计和创意表达能力",
        weight: 0.3,
        evaluationCriteria: [
          "视觉设计水平",
          "创意思维能力",
          "美学判断力",
          "设计工具掌握",
          "设计风格把控"
        ]
      },
      {
        name: "用户体验",
        description: "用户需求理解和体验设计能力",
        weight: 0.25,
        evaluationCriteria: [
          "用户研究能力",
          "交互设计思维",
          "用户行为理解",
          "可用性考虑",
          "体验优化能力"
        ]
      },
      {
        name: "项目执行",
        description: "设计项目的执行和交付能力",
        weight: 0.2,
        evaluationCriteria: [
          "项目时间管理",
          "设计交付质量",
          "版本迭代能力",
          "跨部门协作",
          "设计规范建立"
        ]
      },
      {
        name: "技术理解",
        description: "对技术实现的理解和配合度",
        weight: 0.15,
        evaluationCriteria: [
          "技术可行性考虑",
          "开发配合度",
          "前端技术理解",
          "设计实现效果",
          "技术约束适应"
        ]
      },
      {
        name: "趋势敏感",
        description: "对设计趋势和行业动态的敏感度",
        weight: 0.1,
        evaluationCriteria: [
          "设计趋势关注",
          "行业案例分析",
          "新技术应用",
          "设计方法更新",
          "创新设计思考"
        ]
      }
    ],
    personalDimensions: [
      {
        name: "审美品味",
        description: "审美判断力和艺术素养",
        weight: 0.25,
        evaluationCriteria: [
          "审美判断力",
          "色彩搭配能力",
          "构图理解",
          "艺术素养",
          "细节关注度"
        ]
      },
      {
        name: "沟通协作",
        description: "设计理念表达和团队协作能力",
        weight: 0.25,
        evaluationCriteria: [
          "设计理念表达",
          "方案解释能力",
          "团队协作精神",
          "反馈接受度",
          "跨部门沟通"
        ]
      },
      {
        name: "创新思维",
        description: "创新能力和思维开放性",
        weight: 0.2,
        evaluationCriteria: [
          "创新思维能力",
          "想象力表现",
          "思维开放性",
          "问题解决创意",
          "突破常规思考"
        ]
      },
      {
        name: "学习能力",
        description: "持续学习和技能提升能力",
        weight: 0.15,
        evaluationCriteria: [
          "新工具学习",
          "设计技能提升",
          "行业知识更新",
          "自我反思能力",
          "持续改进意识"
        ]
      },
      {
        name: "抗压能力",
        description: "在压力下保持创意输出的能力",
        weight: 0.15,
        evaluationCriteria: [
          "压力下创意保持",
          "修改意见处理",
          "时间压力管理",
          "情绪稳定性",
          "持续输出能力"
        ]
      }
    ]
  },

  // 通用岗位模板
  {
    position: "general",
    category: "general",
    displayName: "通用岗位",
    description: "适用于未明确分类的岗位的通用评估标准",
    professionalDimensions: [
      {
        name: "专业技能",
        description: "岗位相关的专业知识和技能",
        weight: 0.4,
        evaluationCriteria: [
          "专业知识掌握",
          "技能应用能力",
          "工作经验相关性",
          "专业判断力",
          "行业理解深度"
        ]
      },
      {
        name: "执行能力",
        description: "任务执行和结果交付能力",
        weight: 0.3,
        evaluationCriteria: [
          "任务执行效率",
          "结果交付质量",
          "工作计划能力",
          "问题解决思路",
          "细节关注度"
        ]
      },
      {
        name: "学习发展",
        description: "持续学习和自我发展能力",
        weight: 0.2,
        evaluationCriteria: [
          "学习新知识速度",
          "自我提升意识",
          "知识应用能力",
          "经验总结能力",
          "发展潜力"
        ]
      },
      {
        name: "协作配合",
        description: "团队协作和配合能力",
        weight: 0.1,
        evaluationCriteria: [
          "团队协作精神",
          "沟通配合能力",
          "跨部门协调",
          "服务意识",
          "集体荣誉感"
        ]
      }
    ],
    personalDimensions: [
      {
        name: "沟通表达",
        description: "语言表达和沟通交流能力",
        weight: 0.25,
        evaluationCriteria: [
          "语言表达清晰度",
          "逻辑思维能力",
          "倾听理解能力",
          "非语言沟通",
          "情绪表达控制"
        ]
      },
      {
        name: "学习适应",
        description: "学习能力和环境适应性",
        weight: 0.25,
        evaluationCriteria: [
          "学习接受能力",
          "环境适应性",
          "变化应对能力",
          "开放性思维",
          "持续改进意识"
        ]
      },
      {
        name: "责任心",
        description: "工作责任感和主动性",
        weight: 0.2,
        evaluationCriteria: [
          "工作责任感",
          "主动性表现",
          "承诺履行能力",
          "质量意识",
          "自我管理能力"
        ]
      },
      {
        name: "抗压能力",
        description: "压力承受和情绪管理能力",
        weight: 0.15,
        evaluationCriteria: [
          "压力承受能力",
          "情绪管理能力",
          "困难应对态度",
          "恢复调整能力",
          "持续动力"
        ]
      },
      {
        name: "价值观",
        description: "价值观匹配度和职业素养",
        weight: 0.15,
        evaluationCriteria: [
          "价值观匹配度",
          "职业道德",
          "诚信度",
          "团队精神",
          "企业文化认同"
        ]
      }
    ]
  }
];

// 🔍 岗位匹配工具函数
export function matchPositionTemplate(position: string): PositionTemplate {
  // 标准化输入
  const normalizedPosition = position.toLowerCase().trim();
  
  // 关键词匹配映射
  const keywordMapping: Record<string, string> = {
    // 产品类
    'product_manager_software': 'product_manager_software',
    'product_manager_hardware': 'product_manager_hardware',
    '产品经理（软件）': 'product_manager_software',
    '产品经理（硬件）': 'product_manager_hardware',
    'product': 'product_manager_software', // 默认软件产品经理
    'pm': 'product_manager_software',
    '产品': 'product_manager_software',
    '产品经理': 'product_manager_software',
    'product manager': 'product_manager_software',
    'product owner': 'product_manager_software',
    
    // 技术类
    'engineer': 'software_engineer',
    'developer': 'software_engineer',
    'programmer': 'software_engineer',
    '工程师': 'software_engineer',
    '开发': 'software_engineer',
    '程序员': 'software_engineer',
    'frontend': 'software_engineer',
    'backend': 'software_engineer',
    'fullstack': 'software_engineer',
    'java': 'software_engineer',
    'python': 'software_engineer',
    'javascript': 'software_engineer',
    'react': 'software_engineer',
    'vue': 'software_engineer',
    
    // 销售类
    'sales': 'sales',
    '销售': 'sales',
    'account': 'sales',
    'business development': 'sales',
    'bd': 'sales',
    
    // 设计类
    'design': 'designer',
    'designer': 'designer',
    '设计': 'designer',
    '设计师': 'designer',
    'ui': 'designer',
    'ux': 'designer',
    'visual': 'designer'
  };
  
  // 尝试直接匹配
  const directMatch = POSITION_ASSESSMENT_TEMPLATES.find(
    template => template.position === normalizedPosition
  );
  if (directMatch) return directMatch;
  
  // 关键词匹配
  for (const [keyword, templateKey] of Object.entries(keywordMapping)) {
    if (normalizedPosition.includes(keyword)) {
      const template = POSITION_ASSESSMENT_TEMPLATES.find(
        t => t.position === templateKey
      );
      if (template) return template;
    }
  }
  
  // 返回通用模板
  return POSITION_ASSESSMENT_TEMPLATES.find(t => t.position === 'general')!;
}

// 📊 评估权重计算工具
export function calculateWeightedScore(
  dimensions: AssessmentDimension[],
  scores: Record<string, number>
): number {
  let totalWeightedScore = 0;
  let totalWeight = 0;
  
  dimensions.forEach(dimension => {
    const score = scores[dimension.name] || 0;
    totalWeightedScore += score * dimension.weight;
    totalWeight += dimension.weight;
  });
  
  return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
}