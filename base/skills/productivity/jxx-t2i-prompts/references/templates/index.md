# 内置模板目录

27 条。按题材挑；命中后看该模板的「骨架 / 词库 / 完整示例 / 英文版示例 / 负面 / 调参备注 / 来源」。

脚本列表：`node <skill>/scripts/prompt-lib.mjs list`（本文件不参与校验，不计入条目）。

## 国风（5）

| id | 用途 | 一句话 |
| --- | --- | --- |
| `portrait-guofeng-3d` | 3D 写实国风美女 | 八模块 + 3D/CG 渲染词，秦时明月那种建模感 |
| `portrait-guofeng-tang` | 唐风汉服仕女 | 形制、发髻、首饰写具体，黄昏逆光压塑料感 |
| `portrait-guofeng-song` | 宋制清雅人像 | 低饱和青绿 + 留白 + 团扇竹林，克制路线 |
| `portrait-qipao-retro` | 旗袍复古民国 | 江南雨巷 / 复古洋楼两场景，水墨淡彩与胶片 |
| `portrait-xianxia-cinematic` | 古装仙侠电影感 | 小说封面路数，低角度仰拍 + 双光源 |

## 写实 / 写真（12）

| id | 用途 | 一句话 |
| --- | --- | --- |
| `portrait-photoreal` | 写实人像摄影 | 镜头参数（85mm f/1.4）压过风格词 |
| `portrait-modern-real` | 现代写实女生 | 专治网红脸：写结构 + NOT 式负面 |
| `portrait-street-candid` | 都市街拍抓拍 | 图生图为主，「像我但更好看」 |
| `portrait-jp-fresh-film` | 日系清新胶片 | 过曝 + 胶片 + 富士三件套 |
| `portrait-kr-y2k-campus` | 韩系 Y2K 校园写真 | 图生图套系，一次出 4 张 |
| `portrait-bridal-red` | 婚纱写真（红裙） | 六段模块 + 第一人称视角 |
| `portrait-cg-doll` | 3D 瓷感人偶肖像 | 瓷感材质 + 发丝透光 + 边缘高光 |
| `portrait-editorial-fashion` | 时尚大片 editorial | 硬光 + 骨相 + 高定结构 + 中画幅 |
| `portrait-studio-beauty` | 棚拍美妆特写 | 环形光 + 眼神光 + 可见毛孔 |
| `portrait-headshot-pro` | 商业头像 / 职业照 | 干净背景 + 柔光 + 中性浅笑 |
| `portrait-neon-cyber-night` | 赛博霓虹夜拍 | 双色光源 + 湿地面反射 |
| `portrait-retro-film-35mm` | 复古胶片 35mm | 光晕 + 颗粒 + 抓拍构图 |

## 角色 / 3D（3）

| id | 用途 | 一句话 |
| --- | --- | --- |
| `character-game-cg` | 游戏角色 CG | 设定图语汇，三视图与纯色背景 |
| `character-turnaround-real` | 写实三视图设定 | 建模用：画质封顶 + 精准定参 + 一致性硬约束 |
| `character-cyber-toy-ip` | 赛博机能潮玩 IP | 品牌名 + 色值 + 材质 + 机能件 |

## 插画 / 二次元（4）

| id | 用途 | 一句话 |
| --- | --- | --- |
| `illustration-anime` | 二次元插画 / 日系厚涂 | 角色 + 构图 + 画法三层 |
| `illustration-anime-avatar` | 二次元少女头像 | 1:1 头像位，马卡龙配色 |
| `illustration-anime-healing` | 治愈系动漫小女孩 | 白背景 + 单记忆道具，批量换装 |
| `illustration-niji-anime-girl` | niji 动漫少女插画 | MJ `--niji` + `--sref` 锁风格 |

## 其他品类（3）

| id | 用途 | 一句话 |
| --- | --- | --- |
| `product-commercial` | 产品商业广告 | 材质 + 光位 + 台面 |
| `scene-cinematic` | 电影感场景 | 一个瞬间 + 层次 + 镜头 |
| `poster-visual` | 海报 / 主视觉 | 出视觉、留字位、文字后期 |

## 来源可信度分层

- **有原文可对照**（即梦模板广场 / PromptHub / 优设 / 教程站）：guofeng-3d、tang、song、qipao、xianxia、kr-y2k、jp、street、modern-real、bridal、cg-doll、turnaround、anime-avatar、anime-healing、cyber-toy。
- **社区通行写法归纳**（有官方语法口径，未绑定具体社区条目）：editorial、beauty、headshot、neon、niji、retro-film、photoreal、scene、product、poster。
- 第二层用前按 sourcing.md 的验收判据自行跑 2 张，跑通再把来源改成你的验证记录。
