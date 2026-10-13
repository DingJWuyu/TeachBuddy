export const migrations = [{
  id: 'classroom_0001_roster_assessments',
  up(db) {
    db.exec(`
      CREATE TABLE classroom_classes (accountKey TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,value TEXT NOT NULL,deletedAt TEXT,PRIMARY KEY(accountKey,id));
      CREATE TABLE classroom_students (accountKey TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,value TEXT NOT NULL,classId TEXT NOT NULL,studentNumber TEXT,deletedAt TEXT,PRIMARY KEY(accountKey,id));
      CREATE UNIQUE INDEX classroom_student_number ON classroom_students(accountKey,classId,studentNumber) WHERE deletedAt IS NULL AND studentNumber IS NOT NULL;
      CREATE TABLE classroom_records (accountKey TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,value TEXT NOT NULL,scope TEXT NOT NULL,subjectId TEXT NOT NULL,occurredOn TEXT NOT NULL,deletedAt TEXT,PRIMARY KEY(accountKey,id));
      CREATE TABLE classroom_exams (accountKey TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,value TEXT NOT NULL,occurredOn TEXT NOT NULL,deletedAt TEXT,PRIMARY KEY(accountKey,id));
      CREATE TABLE classroom_results (accountKey TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,value TEXT NOT NULL,examId TEXT NOT NULL,classId TEXT NOT NULL,deletedAt TEXT,PRIMARY KEY(accountKey,id),UNIQUE(accountKey,examId,classId));
      CREATE TABLE classroom_imports (accountKey TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,value TEXT NOT NULL,examId TEXT NOT NULL,classId TEXT NOT NULL,state TEXT NOT NULL,deletedAt TEXT,PRIMARY KEY(accountKey,id));
      CREATE TABLE classroom_tags (accountKey TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,value TEXT NOT NULL,normalizedName TEXT NOT NULL,mergedIntoId TEXT,PRIMARY KEY(accountKey,id),UNIQUE(accountKey,normalizedName));
    `);
  }
}];
