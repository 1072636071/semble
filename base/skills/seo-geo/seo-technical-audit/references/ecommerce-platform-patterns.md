# E-commerce Platform SEO Patterns

识别平台、跳到对应段落、运行诊断检查、在模板级应用修复。

## Shopify

**Identify**: `cdn.shopify.com`、`/products/`、`/collections/`、`/cart` URL。

| Symptom | Root Cause |
|---------|-----------|
| Variants not indexed | Canonical points to parent; `?variant=` dropped |
| Collection pagination loop | No `rel="prev/next"` in newer themes |
| Filter URLs indexed | Faceted URLs (`?filter.p.vendor=`) leaking |
| Tag URLs cannibalizing | `/collections/<tag>` duplicates category |

**Fix locations**: `sections/product-template.liquid`、`sections/collection-template.liquid`、`layout/theme.liquid`、`robots.txt.liquid`（仅 Plus）。

**Noindex**: Tag 页、`/collections/vendors`、`/collections/types`、`/cart`、`/checkout`、`/account`。Variant URL 应 canonical 到父级。

## WooCommerce

**Identify**: `/wp-content/plugins/woocommerce/`、`/product-category/`、`woocommerce` body class。

| Symptom | Root Cause |
|---------|-----------|
| Attribute filter URLs indexed | WooCommerce attribute archives (`/pa_color/red/`) |
| Tag + category cannibalization | Both taxonomies ranking for same terms |
| Pagination indexed individually | `/shop/page/2/` without canonical strategy |
| Duplicate meta across products | Default SEO plugin templates not customized |

**Fix locations**: `functions.php` / 子主题、Yoast/Rank Math 插件设置、`robots.txt`、`single-product.php`。

**Block/noindex**: `?add-to-cart=`、`?orderby=`、`?min_price=`、attribute archive、product tag。

## Headless (Next.js / Remix / Astro / Gatsby)

**Identify**: 源码中 `_next/`、`_astro/`、`_remix/`。CMS: Contentful / Sanity / Strapi / WP headless。

| Symptom | Root Cause |
|---------|-----------|
| Content not indexed | Client-side rendering only, no SSR/prerender |
| Meta tags missing/generic | Rendered by JS after initial HTML |
| Canonical tags all point to `/` | Hardcoded canonical in template |
| Schema missing/malformed | JSON-LD generated client-side |

**Key fixes**: 确保 SSR/SSG（非 CSR）。在初始 HTML render 中返回 canonical、meta、schema。检查 `view-source:` 而非 DevTools。设合理 Cache-Control（HTML 上不要 `max-age=31536000`）。为 CLS 修 `next/image` width/height。

## BigCommerce

**Identify**: 源码中 `stencil-themes`、`cdn11.bigcommerce.com`。

| Symptom | Root Cause |
|---------|-----------|
| Facet URL bloat | Default `?Facet=` URLs exposed |
| Brand + category overlap | `/brands/` duplicates `/categories/` |
| Stencil theme meta issues | Handlebars templates don't escape variant data |

**Fix locations**: Stencil `templates/components/products/*.html`、`config.json`、Control Panel SEO 设置。

## Magento 2

**Identify**: 资源中 `/static/version*/frontend/`、`Mage_Core`。

| Symptom | Root Cause |
|---------|-----------|
| `.html` + non-`.html` duplicates | URL rewrite table conflicts |
| Layered nav URLs indexed | Default layered navigation exposed |
| Session ID in URLs | Legacy Magento 1 setting post-migration |
| Multi-store duplication | Store views share canonical base |

**Fix locations**: Admin > Stores > Configuration > Catalog > SEO、`Magento_CatalogUrlRewrite`、主题模板。

## Universal Checklist

- [ ] 产品页: `Product` schema 含 `offers.price`、`availability`、`aggregateRating`
- [ ] 分类页: 唯一 meta description（非自动生成）
- [ ] Faceted nav: `noindex,follow` 或 `Disallow` 或 canonical 到父级
- [ ] Pagination: `rel="next/prev"` 或带内容差异的 self-canonical
- [ ] Out-of-stock: 301 到分类、"notify me" 表单，或永久则 410
- [ ] Variations: 一个 canonical，其余 `noindex` 或基于 hash
- [ ] 所有分类/产品/博客页有 `BreadcrumbList` schema
- [ ] International: `hreflang` + self-referential + x-default
