const STORAGE_KEY = "studyTrackerData";

const defaultData = {
    subjects: [],
    tasks: []
};

let data = loadData();
let currentFilter = "all";

const subjectForm = document.getElementById("subjectForm");
const subjectName = document.getElementById("subjectName");
const subjectList = document.getElementById("subjectList");

const taskForm = document.getElementById("taskForm");
const taskName = document.getElementById("taskName");
const taskSubject = document.getElementById("taskSubject");
const taskList = document.getElementById("taskList");

const totalSubjects = document.getElementById("totalSubjects");
const totalTasks = document.getElementById("totalTasks");
const completedTasks = document.getElementById("completedTasks");
const progressPercent = document.getElementById("progressPercent");
const progressBar = document.getElementById("progressBar");
const progressLabel = document.getElementById("progressLabel");
const todayDate = document.getElementById("todayDate");


// Load saved data from the browser
function loadData() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);

        if (!savedData) {
            return {
                subjects: [],
                tasks: []
            };
        }

        const parsedData = JSON.parse(savedData);

        if (
            !parsedData ||
            !Array.isArray(parsedData.subjects) ||
            !Array.isArray(parsedData.tasks)
        ) {
            return {
                subjects: [],
                tasks: []
            };
        }

        return parsedData;
    } catch (error) {
        console.error("Could not load saved data:", error);
        return {
            subjects: [],
            tasks: []
        };
    }
}


// Save data to the browser
function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        alert("Data save nahi ho paya. Browser storage check karo.");
        console.error("Could not save data:", error);
    }
}


// Create HTML elements safely
function createElement(tag, className, text = "") {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    element.textContent = text;

    return element;
}


// Find a subject using its ID
function getSubject(subjectId) {
    return data.subjects.find(
        subject => subject.id === subjectId
    );
}


// Display today's date
function showDate() {
    todayDate.textContent = new Date().toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


// Add a new subject
subjectForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = subjectName.value.trim();

    if (!name) {
        return;
    }

    const alreadyExists = data.subjects.some(
        subject => subject.name.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
        alert("Ye subject pehle se added hai!");
        return;
    }

    const subject = {
        id: crypto.randomUUID(),
        name: name,
        createdAt: Date.now()
    };

    data.subjects.push(subject);

    saveData();
    subjectForm.reset();
    renderAll();
    subjectName.focus();
});


// Display all subjects
function renderSubjects() {
    subjectList.replaceChildren();

    if (data.subjects.length === 0) {
        const empty = createElement(
            "div",
            "empty-state",
            "Abhi koi subject nahi hai. Apna pehla subject add karo!"
        );

        subjectList.appendChild(empty);
    }

    data.subjects.forEach(function (subject, index) {
        const item = createElement("div", "subject-item");

        const dot = createElement("span", "subject-dot");

        const colors = [
            "#9270ff",
            "#65b7ff",
            "#54d6a0",
            "#ffb86b",
            "#ff8eaa"
        ];

        dot.style.backgroundColor = colors[index % colors.length];

        const info = createElement("div", "subject-info");
        const title = createElement("strong", "", subject.name);

        const count = data.tasks.filter(
            task => task.subjectId === subject.id
        ).length;

        const description = createElement(
            "p",
            "",
            count + (count === 1 ? " study task" : " study tasks")
        );

        info.append(title, description);

        const deleteButton = createElement(
            "button",
            "delete-btn",
            "×"
        );

        deleteButton.type = "button";
        deleteButton.title = "Delete subject";
        deleteButton.setAttribute(
            "aria-label",
            "Delete subject " + subject.name
        );

        deleteButton.addEventListener("click", function () {
            const confirmed = confirm(
                'Delete "' + subject.name +
                '" and all its study tasks?'
            );

            if (!confirmed) {
                return;
            }

            data.subjects = data.subjects.filter(
                item => item.id !== subject.id
            );

            data.tasks = data.tasks.filter(
                task => task.subjectId !== subject.id
            );

            saveData();
            renderAll();
        });

        item.append(dot, info, deleteButton);
        subjectList.appendChild(item);
    });

    // Update subject dropdown
    const previousSelection = taskSubject.value;

    taskSubject.replaceChildren();

    const placeholder = createElement(
        "option",
        "",
        data.subjects.length
            ? "Select a subject"
            : "Add a subject first"
    );

    placeholder.value = "";
    taskSubject.appendChild(placeholder);

    data.subjects.forEach(function (subject) {
        const option = createElement(
            "option",
            "",
            subject.name
        );

        option.value = subject.id;
        taskSubject.appendChild(option);
    });

    if (
        data.subjects.some(
            subject => subject.id === previousSelection
        )
    ) {
        taskSubject.value = previousSelection;
    }

    taskSubject.disabled = data.subjects.length === 0;
}


// Add a new study task
taskForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = taskName.value.trim();
    const subjectId = taskSubject.value;

    if (!name || !getSubject(subjectId)) {
        alert("Pehle ek valid subject select karo.");
        return;
    }

    const task = {
        id: crypto.randomUUID(),
        name: name,
        subjectId: subjectId,
        completed: false,
        createdAt: Date.now()
    };

    data.tasks.unshift(task);

    saveData();
    taskForm.reset();

    currentFilter = "all";
    updateFilterButtons();
    renderAll();

    taskName.focus();
});


// Display study tasks
function renderTasks() {
    taskList.replaceChildren();

    const filteredTasks = data.tasks.filter(function (task) {
        if (currentFilter === "pending") {
            return !task.completed;
        }

        if (currentFilter === "completed") {
            return task.completed;
        }

        return true;
    });

    if (filteredTasks.length === 0) {
        let message = "Abhi koi task nahi hai. Apna pehla task add karo!";

        if (currentFilter === "pending") {
            message = "Great! Koi pending task nahi hai.";
        } else if (currentFilter === "completed") {
            message = "Abhi koi completed task nahi hai.";
        }

        const empty = createElement("div", "empty-state");
        const icon = createElement("span", "", "✓");
        const text = createElement("p", "", message);

        empty.append(icon, text);
        taskList.appendChild(empty);
    }

    filteredTasks.forEach(function (task) {
        const item = createElement(
            "div",
            task.completed ? "task-item completed" : "task-item"
        );

        const checkbox = createElement("input", "task-check");

        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute(
            "aria-label",
            "Mark " + task.name + " as completed"
        );

        checkbox.addEventListener("change", function () {
            task.completed = checkbox.checked;

            saveData();
            renderAll();
        });

        const info = createElement("div", "task-info");
        const title = createElement("strong", "", task.name);

        const subject = getSubject(task.subjectId);

        const description = createElement(
            "p",
            "",
            subject ? subject.name : "Unknown subject"
        );

        info.append(title, description);

        const deleteButton = createElement(
            "button",
            "delete-btn",
            "×"
        );

        deleteButton.type = "button";
        deleteButton.title = "Delete task";
        deleteButton.setAttribute(
            "aria-label",
            "Delete task " + task.name
        );

        deleteButton.addEventListener("click", function () {
            data.tasks = data.tasks.filter(
                item => item.id !== task.id
            );

            saveData();
            renderAll();
        });

        item.append(checkbox, info, deleteButton);
        taskList.appendChild(item);
    });
}


// Update dashboard statistics
function renderStats() {
    const total = data.tasks.length;

    const completed = data.tasks.filter(
        task => task.completed
    ).length;

    const percentage = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    totalSubjects.textContent = data.subjects.length;
    totalTasks.textContent = total;
    completedTasks.textContent = completed;

    progressPercent.textContent = percentage + "%";
    progressLabel.textContent = percentage + "% completed";
    progressBar.style.width = percentage + "%";

    progressBar.setAttribute("role", "progressbar");
    progressBar.setAttribute("aria-valuemin", "0");
    progressBar.setAttribute("aria-valuemax", "100");
    progressBar.setAttribute("aria-valuenow", percentage);
}


// Handle All, Pending and Completed filters
document.querySelectorAll(".filter-btn").forEach(
    function (button) {
        button.addEventListener("click", function () {
            currentFilter = button.dataset.filter;

            updateFilterButtons();
            renderTasks();
        });
    }
);


function updateFilterButtons() {
    document.querySelectorAll(".filter-btn").forEach(
        function (button) {
            const isActive = button.dataset.filter === currentFilter;

            button.classList.toggle("active", isActive);
            button.setAttribute(
                "aria-pressed",
                String(isActive)
            );
        }
    );
}


// Render the entire website
function renderAll() {
    renderSubjects();
    renderTasks();
    renderStats();
}


// Start the website
showDate();
updateFilterButtons();
renderAll();
