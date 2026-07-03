# Sistema de Cache

## Cache em Memória

O sistema utiliza cache em memória (padrão do NestJS) para melhorar o desempenho das consultas. **Não é necessário configurar Redis ou qualquer serviço externo.**

## Variáveis de Ambiente (Opcional)

Você pode configurar o TTL (Time To Live) do cache através da variável de ambiente:

```env
# Cache Configuration (Opcional)
CACHE_TTL=900  # 15 minutos em segundos (padrão: 900)
```

Se não configurar, o sistema usará 15 minutos (900 segundos) como padrão.

## Cache Keys

O sistema usa as seguintes chaves de cache:
- `products:all` - Lista completa de produtos (arsenal)
- `blog:all` - Lista completa de blog posts
- `releases:all` - Lista completa de releases

## Invalidação Automática

O cache é automaticamente invalidado quando:
- Um produto é criado, atualizado ou deletado
- Um blog post é criado, atualizado ou deletado
- Um release é criado, atualizado ou deletado

## Notas Importantes

- O cache é **não persistente** (em memória apenas)
- O cache é limpo quando a aplicação é reiniciada
- Para ambientes com múltiplas instâncias, cada instância terá seu próprio cache
- O cache em memória é suficiente para a maioria dos casos de uso

