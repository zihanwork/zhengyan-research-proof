# 证研 · 投研结论核验台提交说明

- 可操作 Web 产品：https://zhengyan-research-proof.vercel.app/
- 源码仓库与 README：https://github.com/zihanwork/zhengyan-research-proof
- AI 使用与修正记录：https://github.com/zihanwork/zhengyan-research-proof/blob/main/docs/AI_USAGE.md
- 真实模型运行与验证：https://github.com/zihanwork/zhengyan-research-proof/blob/main/docs/REAL_AI_VALIDATION.md
- 测试说明：https://github.com/zihanwork/zhengyan-research-proof/blob/main/docs/TESTING.md
- 原始模型、证据与复核记录：https://github.com/zihanwork/zhengyan-research-proof/blob/main/data/verified-ai-run.json

目标用户是发布盘后点评前的 A 股研究员和复核人。产品将自然语言观点拆成可核验主张，再通过扶摇与 iFinD 取证，确定性计算与判定，保留原始字段、时点、单位、口径及复核反馈。模型负责语义规划，不负责最终数值心算或交易建议。

评审可直接在正式站点输入观点并生成核验清单，无需自备模型密钥；初始回放与固定示例取证始终单独标注。建议操作：输入观点 → 生成核验清单 → 确认计划并取证 → 打开证据 → 逐条复核 → 导出 Markdown 或证据 JSON。

已经完成真实模型与真实金融接口的完整流程，并提供原始运行记录、4项独立复算与19项既有自动测试。实际样例结果为2条支持、1条不支持、1条因果未知；确认未知不会将它改为支持。

复核操作由 Codex 执行验收，不冒称实际研究员签审。真实用户访谈、人工与产品的配对效率实验、总体语义准确率尚未验证，目标指标不作为已实现结果。产品不提供确定性涨跌预测、收益承诺或直接买卖建议。
