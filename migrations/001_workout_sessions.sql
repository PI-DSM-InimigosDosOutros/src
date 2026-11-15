-- Executar uma vez no banco de desenvolvimento após conferir o esquema existente.
-- Não recria nem corrige o script original de criação do banco.
CREATE TABLE IF NOT EXISTS WorkoutSession (
  IdWorkoutSession INT NOT NULL AUTO_INCREMENT,
  IdDailyWorkout INT NOT NULL,
  IdUser INT NOT NULL,
  Date DATE NOT NULL,
  Title VARCHAR(100) NOT NULL,
  Status ENUM('active', 'completed', 'ended') NOT NULL DEFAULT 'active',
  StartedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FinishedAt DATETIME NULL,
  TotalDurationSeconds DECIMAL(12,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (IdWorkoutSession),
  KEY idx_session_user (IdUser, Date),
  CONSTRAINT fk_session_user FOREIGN KEY (IdUser) REFERENCES User (IdUser) ON DELETE CASCADE,
  CONSTRAINT fk_session_workout FOREIGN KEY (IdDailyWorkout) REFERENCES DailyWorkout (IdDailyWorkout) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Preserva os dias programados anteriores quando o usuário altera a disponibilidade.
CREATE TABLE IF NOT EXISTS UserScheduleVersion (
  IdUserScheduleVersion INT NOT NULL AUTO_INCREMENT,
  IdUser INT NOT NULL,
  EffectiveDate DATE NOT NULL,
  Days VARCHAR(30) NOT NULL,
  PRIMARY KEY (IdUserScheduleVersion),
  UNIQUE KEY uq_schedule_date (IdUser, EffectiveDate),
  CONSTRAINT fk_schedule_user FOREIGN KEY (IdUser) REFERENCES User (IdUser) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS WorkoutSessionExercise (
  IdWorkoutSessionExercise INT NOT NULL AUTO_INCREMENT,
  IdWorkoutSession INT NOT NULL,
  IdWorkout INT NOT NULL,
  ExerciseOrder INT NOT NULL,
  Name VARCHAR(100) NOT NULL,
  DurationSeconds DECIMAL(12,3) NOT NULL DEFAULT 0,
  Completed BOOLEAN NOT NULL DEFAULT 0,
  PRIMARY KEY (IdWorkoutSessionExercise),
  UNIQUE KEY uq_session_order (IdWorkoutSession, ExerciseOrder),
  CONSTRAINT fk_session_exercise_session FOREIGN KEY (IdWorkoutSession) REFERENCES WorkoutSession (IdWorkoutSession) ON DELETE CASCADE,
  CONSTRAINT fk_session_exercise_catalog FOREIGN KEY (IdWorkout) REFERENCES Workout (IdWorkout)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
