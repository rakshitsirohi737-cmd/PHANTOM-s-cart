students = []


def add_student():
	roll = input("Enter Roll No: ")
	name = input("Enter Name: ")
	course = input("Enter Course: ")
	student = {
		"roll": roll,
		"name": name,
		"course": course,
	}
	students.append(student)
	print("Student added successfully!")


def view_students():
	if not students:
		print("No students found.")
		return

	for student in students:
		print("Roll No:", student["roll"])
		print("Name:", student["name"])
		print("Course:", student["course"])
		print("-------------------")


def search_student():
	roll = input("Enter Roll No to search: ")
	for student in students:
		if student["roll"] == roll:
			print("Student Found!")
			print("Name:", student["name"])
			print("Course:", student["course"])
			return

	print("Student not found.")


while True:
	print("\n===== STUDENT MANAGEMENT SYSTEM =====")
	print("1. Add Student")
	print("2. View Students")
	print("3. Search Student")
	print("4. Exit")

	choice = input("Enter your choice: ")

	if choice == "1":
		add_student()
	elif choice == "2":
		view_students()
	elif choice == "3":
		search_student()
	elif choice == "4":
		print("CHAL NIKAL
        
        !")
		break
	else:
		print("Invalid choice. Please enter 1, 2, 3, or 4.")