# Configuração Cloudinary

## Variáveis de Ambiente Necessárias

Adicione as seguintes variáveis ao arquivo `.env` do backend:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=dgupfcxne
CLOUDINARY_API_KEY=688557444899231
CLOUDINARY_API_SECRET=d7rzv1l_Ehsb6IbbvEGOoSMP0Yo
```

## Estratégia de Migração

- **Músicas (Rádio)**: Continuam no Cloudflare R2
- **Imagens Antigas**: Permanecem no R2 (sem migração forçada)
- **Novas Imagens**: Vão automaticamente para Cloudinary com otimizações SEO:
  - Blog: `/dashboard/blog` - upload de imagens
  - Produtos: `/dashboard/products` - upload de imagens
  - Releases: `/dashboard/releases` - upload de imagens

## Otimizações Aplicadas

- Qualidade: `auto:good` (80-85% otimizada)
- Formato: `auto` (WebP/AVIF automático)
- JPEG Progressivo habilitado
- Redução de tamanho: 60-80% menor que original

## Compatibilidade

O sistema suporta ambos os serviços:
- URLs antigas do R2 continuam funcionando
- Novas URLs do Cloudinary são geradas automaticamente
- Next.js Image detecta automaticamente a origem

