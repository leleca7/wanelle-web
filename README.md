# Wanelle Web

Sistema de gestão da **Wanelle Tortas**.

> Bolos feitos para fazer parte da história.

## Stack

- Next.js + TypeScript
- Neon Postgres
- Neon Auth
- Neon Data API
- Row-Level Security (RLS)

A Wanelle usa um projeto Neon próprio e separado de outros projetos da conta.

## Funcional nesta versão

- Login e criação de conta
- Controle de membros autorizados
- Dashboard com dados reais
- Pedidos em Kanban
- Cadastro de cliente + pedido + item
- Agenda alimentada ao criar pedido
- Registro de pagamento inicial no financeiro
- Atualização de status do pedido
- Alertas de estoque baixo
- Logos oficiais e identidade visual Wanelle

## Primeiro acesso

1. Abra `/login` e crie a primeira conta.
2. Após entrar, a tela exibirá o **ID do usuário**.
3. Esse ID deve ser cadastrado em `app_members` como `admin`.
4. Depois disso, a conta passa a enxergar e alterar os dados da Wanelle.

Nenhum novo cadastro recebe acesso ao negócio automaticamente.

## Variáveis públicas

Copie `.env.example` para `.env.local` em desenvolvimento. As URLs do Auth e Data API são endpoints públicos; as regras de acesso ficam no Postgres via autenticação e RLS.

## Próximos módulos

- Agenda completa
- Estoque com entradas e saídas
- Financeiro detalhado
- Produtos e fichas técnicas
- Clientes e histórico
- Venda rápida de fatias
