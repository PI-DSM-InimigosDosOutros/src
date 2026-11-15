# WorkIn — API

Backend Node/Express/MySQL. A integração foi alinhada ao SQL fornecido pela equipe. O script original de criação do banco não foi alterado (item 2 da análise ficou fora do trabalho).

## Preparação

1. Conferir o esquema realmente publicado no Alwaysdata.
2. Aplicar `migrations/001_workout_sessions.sql` no banco escolhido, após revisão/backup da equipe. O arquivo cria `WorkoutSession`, `WorkoutSessionExercise` e `UserScheduleVersion`; não recria tabelas existentes nem preenche sessões históricas.
3. Configurar `.env` a partir de `.env.example`: MySQL, JWT_SECRET, APP_TIMEZONE, SMTP, MAIL_FROM, FRONTEND_URL, GEMINI_API_KEY e GEMINI_MODEL. Não enviar credenciais ao Git.
4. Ao publicar a correção da antiga rota de token, trocar JWT_SECRET para invalidar tokens que possam ter sido emitidos sem senha. Isso encerra sessões antigas.
5. Iniciar com `npm start`. O frontend real precisa de EXPO_PUBLIC_API_URL e EXPO_PUBLIC_DATA_MODE=api, com reinício do Expo.

Sem as tabelas novas ou a configuração externa, partes da API retornam erro de indisponibilidade; não trocam para exemplos nem confirmam envio de e-mail inexistente. SMTP ausente não imprime links de recuperação no console.

## Contratos

Todas as rotas têm prefixo `/api`. As autenticadas exigem `Authorization: Bearer <token>`. Respostas usam `{ success: true, data }` ou `{ success: false, error }`.

- `POST /token`: 410; emissão por e-mail sem senha foi desativada.
- `POST /auth/login`: `{ email, password }` → `{ token, user: { id, firstName, lastName, email } }`.
- `POST /user/register`: cadastro completo descrito abaixo; retorna autenticação com HTTP 201.
- `GET /user/profile`: perfil normalizado, sem senha/hash. Dados ainda não preenchidos em contas antigas ficam sem informação; medidas numéricas ausentes são 0 no DTO e a interface mostra “Não informado”.
- `PUT /user/profile`: atualização parcial dos campos do perfil. Preserva outros grupos de informações; medidas novas entram no histórico de UserMeasures.
- `POST /user/change-password`: `{ currentPassword, newPassword }`, autenticado e com conferência da senha atual.
- `POST /user/forgot-password`: `{ email }`; requer SMTP e FRONTEND_URL válidos. Resposta genérica para não confirmar se o e-mail existe.
- `POST /user/reset-password`: `{ token, newPassword }`; token de recuperação vence em 15 minutos e fica inválido após mudança do hash.
- `GET /wod`: treino ativo ou o último treino do dia, sem misturar exercícios de treinos diferentes. Inclui `activeSession` para recuperar o progresso confirmado; datas são YYYY-MM-DD.
- `POST /workout/create`: gera com as modalidades do perfil e catálogo do banco, somente em dia programado e dentro dos minutos disponíveis. Salva DailyWorkout e DailyWorkoutExercise em transação. Retorna o mesmo formato de `/wod`, HTTP 201.
- `POST /workout/start`: `{ dailyWorkoutId }` → `{ dailyWorkoutId, session, firstExercise }`. Repetição durante sessão ativa reaproveita a mesma sessão; outro treino ativo gera conflito.
- `POST /workout/progress`: `{ sessionId, exerciseOrder, durationSeconds }` → `{ isFinished, nextExercise, session }`. Repetir a mesma conclusão retorna o progresso sem concluir outro exercício nem sobrescrever o tempo confirmado.
- `POST /workout/finish`: `{ sessionId, interruptedExercise?: { exerciseOrder, durationSeconds } }` → resumo persistido. Repetir a finalização devolve o mesmo resumo. O servidor determina `completed` ou `ended`, conforme as conclusões registradas.
- `GET /workout/history`: resumos concluídos/encerrados do usuário, com `id`, `dailyWorkoutId`, `date`, `title`, `status`, `durationSeconds` e `exercises`.
- `GET /workout/metrics`: sequência, último dia concluído e semana. Usa os dias programados e as versões de disponibilidade registradas a partir desta integração.

Os pedidos de sessão sempre identificam o treino/sessão e o exercício. A propriedade é conferida pelo usuário do JWT. Transações bloqueiam a linha do usuário para serializar alterações concorrentes da sua prática. Encerramento parcial não incrementa a sequência. A finalização não altera a duração estimada para aparentar tempo medido.

## Perfil e banco

Campos do cadastro: fullName, birthDate (ISO), gender, email, password, heightCm, weightKg, activityLevel (opcional), medicalNotes (opcional), goal, exerciseCategories, availableMinutesPerDay e availableDays.

- fullName: primeiro nome → FirstName; restante → LastName. Ambos têm até 100 caracteres.
- Gênero: Feminino → F; Masculino → M; Não binário → N; Prefiro não informar → P. Conferir os códigos das contas já existentes antes de publicar; os códigos não reconhecidos não são convertidos silenciosamente.
- heightCm / weightKg → UserMeasures.Height / Weight (até 999,99, duas casas decimais).
- goal / availableMinutesPerDay → UserPreferences.Goal / FreeTimePerDay.
- medicalNotes / activityLevel → HealthySituation / WorkoutHistory.
- Modalidades → UserPreferencesCategory, consultando IDs de ExerciseCategory pelos nomes.
- Dias ISO (segunda=1, domingo=7) → UserAvailableDay, consultando os IDs reais de DaysWeek pelo nome.
- As opções atuais são Equilíbrio, Flexibilidade, Cardio, Musculação, HIIT e Calistenia, conforme o SQL. Códigos e nomes são validados antes da gravação.
- Preferências e observações: até 1000 caracteres; e-mail: até 150. Cadastro, alteração e redefinição de senha seguem os quatro requisitos do protótipo (8–16 caracteres, maiúscula, número e especial).
- A cor continua sendo preferência do dispositivo, sem campo novo no banco.

Cadastro é uma transação: User, UserLogin, medidas, preferências, relações, Streak e versão de disponibilidade são confirmados juntos ou revertidos.

## Geração e limites

A criação chama o serviço Gemini existente, carregado apenas nessa operação. O modelo é configurado por GEMINI_MODEL; não se presume que um nome fixo esteja disponível na conta. A resposta é validada contra o catálogo filtrado, ordens sequenciais únicas, minutos inteiros positivos e tempo máximo. Não há fallback silencioso para treino fictício nem repetição automática da chamada de criação.

Os limites AI_MAX_REQUESTS_PER_MINUTE/DAY e AI_MAX_TOKENS_PER_DAY são contadores por processo. Reiniciar o servidor reinicia esses contadores; múltiplas instâncias não os compartilham. Tokens são contabilizados pelo uso retornado pelo provedor, portanto a última chamada pode ultrapassar o saldo. Para controle de gastos em produção, configurar também as cotas do provedor e armazenamento compartilhado se houver múltiplas instâncias.

## Verificação e limites conhecidos

`npm test` usa o runner nativo do Node e verifica validações, HTTP/JWT, transações com executor controlado, relações por IDs reais, isolamento de sessão, repetição de conclusão/finalização e métricas. Os testes não substituem executar os comandos no MySQL/MariaDB do ambiente da equipe.

Não foram executados scripts no Alwaysdata, enviados e-mails reais ou consumidas chamadas Gemini. Não há credenciais/configuração da equipe disponíveis neste ambiente. O Docker local também não estava ativo para testar a migração em um motor MySQL isolado.

Tempos e situação de sessões antigas não podem ser reconstruídos a partir do esquema anterior. A migração não inventa esse histórico. A retomada pelo servidor recupera os exercícios e tempos já confirmados; o tempo de um exercício em andamento ainda não enviado pode ser perdido ao fechar/recarregar. O modo mock mantém seus checkpoints locais separados da conta real.
