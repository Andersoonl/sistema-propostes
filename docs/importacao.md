# Layouts de Importação CSV

Este documento descreve os layouts de arquivos CSV para importação de dados no sistema de controle de produção.

## 1. Produtos

**Arquivo:** `produtos.csv`

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| nome | texto | Sim | Nome único do produto |

**Exemplo:**
```csv
nome
Bloco 14x19x39
Bloco 19x19x39
Paver 10x20
Canaleta
```

## 2. Motivos de Parada (Hierarquia)

**Arquivo:** `motivos.csv`

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| nivel | inteiro (1-3) | Sim | Nível hierárquico |
| nome | texto | Sim | Nome do motivo |
| pai | texto | NV2/NV3 | Nome do motivo pai |

**Regras:**
- NV1: Categoria principal (sem pai)
- NV2: Subcategoria (pai = NV1)
- NV3: Motivo específico (pai = NV2)

**Exemplo:**
```csv
nivel,nome,pai
1,Mecânica,
1,Elétrica,
2,Hidráulica,Mecânica
2,Pneumática,Mecânica
2,Motor,Elétrica
3,Vazamento de óleo,Hidráulica
3,Cilindro travado,Hidráulica
3,Motor queimado,Motor
```

## 3. Produção Diária

**Arquivo:** `producao.csv`

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| data | data (YYYY-MM-DD) | Sim | Data do lançamento |
| maquina | texto | Sim | Nome da máquina (VP1, VP2, HZEN) |
| produto | texto | Sim | Nome do produto |
| ciclos | inteiro | Sim | Quantidade de ciclos |
| hora_inicio | hora (HH:mm) | Não | Horário de início (se troca de produto) |
| hora_fim | hora (HH:mm) | Não | Horário de fim (se troca de produto) |
| observacoes | texto | Não | Observações gerais |

**Exemplo:**
```csv
data,maquina,produto,ciclos,hora_inicio,hora_fim,observacoes
2024-01-15,VP1,Bloco 14x19x39,450,07:00,12:00,
2024-01-15,VP1,Paver 10x20,280,13:00,17:00,Troca de molde
2024-01-15,VP2,Bloco 19x19x39,520,,,Produção normal
2024-01-15,HZEN,Canaleta,380,,,
```

## 4. Paradas

**Arquivo:** `paradas.csv`

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| data | data (YYYY-MM-DD) | Sim | Data da parada |
| maquina | texto | Sim | Nome da máquina |
| motivo_nv3 | texto | Sim | Nome do motivo NV3 (folha) |
| duracao_min | inteiro | Sim | Duração em minutos |
| observacao | texto | Não | Observação sobre a parada |

**Exemplo:**
```csv
data,maquina,motivo_nv3,duracao_min,observacao
2024-01-15,VP1,Vazamento de óleo,45,Reparo na bomba
2024-01-15,VP1,Troca de molde,30,
2024-01-15,VP2,Motor queimado,120,Aguardando peça
2024-01-16,HZEN,Lubrificação,15,Manutenção preventiva
```

## 5. Override de Turno

**Arquivo:** `turnos_especiais.csv`

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| data | data (YYYY-MM-DD) | Sim | Data do turno especial |
| maquina | texto | Sim | Nome da máquina |
| hora_inicio | hora (HH:mm) | Sim | Horário de início |
| hora_fim | hora (HH:mm) | Sim | Horário de fim |
| pausa_min | inteiro | Sim | Total de pausas em minutos |

**Exemplo:**
```csv
data,maquina,hora_inicio,hora_fim,pausa_min
2024-01-20,VP1,06:00,18:00,90
2024-01-20,VP2,06:00,18:00,90
2024-01-21,HZEN,08:00,12:00,15
```

---

## Notas de Importação

1. **Encoding:** UTF-8
2. **Separador:** Vírgula (,)
3. **Formato de data:** YYYY-MM-DD (ISO 8601)
4. **Formato de hora:** HH:mm (24h)
5. **Campos vazios:** Deixar em branco (não usar NULL)

## Validações

- Máquinas válidas: VP1, VP2, HZEN
- Produtos devem existir antes de importar produção
- Motivos NV3 devem existir antes de importar paradas
- Máximo 2 produtos por máquina por dia
- Duração de parada deve ser > 0
