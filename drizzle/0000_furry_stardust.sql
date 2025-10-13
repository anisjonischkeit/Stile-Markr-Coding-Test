CREATE TABLE "test_results" (
	"student_number" text NOT NULL,
	"test_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"scanned_on" text,
	"available_marks" integer NOT NULL,
	"obtained_marks" integer NOT NULL,
	CONSTRAINT "test_results_student_number_test_id_pk" PRIMARY KEY("student_number","test_id")
);
