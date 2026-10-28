# 视觉资源

按用户提供的视觉提示实现：单屏、全幅循环视频、黑白胶囊导航、纯白标题、点阵统计符号、入场动画、移动菜单。中文内容与金融核验工作流保留；复杂交互沿用现有 React/Vinext 实现。

- 背景视频：使用用户指定的 CloudFront URL，通过浏览器直接播放；未下载或再打包视频。
- Inter：Google Fonts，UI 字体。
- BubbledotICG-FinePos：用户指定 OnlineWebFonts CSS。主要用于点阵符号；中文在字体缺字时使用系统中文字体。字体来源与 CC BY 4.0 链接在「方法与边界」中列明。
- Geist Pixel Circle：来自 vercel/geist-font 官方仓库的 WOFF2，位于 `public/fonts/GeistPixel-Circle.woff2`，许可见同目录 `GEIST-LICENSE.txt`。
- 品牌标记与功能图标：Lucide SVG，保留原有证研图形标记。

不使用虚构企业背书或性能指标。首屏统计取自当前核验记录，数据回放、故障注入或在线结果均标识模式。
