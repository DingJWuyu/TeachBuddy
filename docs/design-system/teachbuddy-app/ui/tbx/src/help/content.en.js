/*
 * Help articles (English). Same ids and blocks as content.zh.js.
 * Sample copy, written to set the layout; the real articles will replace it.
 */
export const TOPICS = [
  {
    id: 'start',
    icon: 'sparkles',
    hue: 'teal',
    title: 'Get Started',
    blurb: 'Meet the workbench and be up and running in minutes.',
    articles: [
      {
        id: 'welcome',
        title: 'Welcome to TeachBuddy',
        summary: 'Questions, schedule, files and an assistant, all in one place.',
        minutes: 3,
        blocks: [
          ['p', 'TeachBuddy is a workbench made for teachers. The questions you teach with, your weekly timetable, slides and handouts, and an assistant you can think things through with all live here, and each can reference the others.'],
          ['figure', 'home', 'Home: ask the assistant something, or start with a suggestion.'],
          ['h2', 'Four modules'],
          ['list', [
            '**Question Bank**: enter questions or import them from files, organize by type and tag, and find them in seconds.',
            '**Schedule**: classes, meetings and to-dos in one calendar. The task view lays out your whole week.',
            '**Resource Library**: slides, tests and images you can preview and reuse.',
            '**Math Workshop**: formulas, graphs and classroom demos you can drop straight into slides.',
          ]],
          ['h2', 'The assistant'],
          ['p', 'Home is the assistant. Ask it to plan a lesson’s teaching order, find practice questions, or design tiered homework. It checks your question bank and schedule, then turns the results into cards you can use right away.'],
          ['tip', 'New here? On Home, click **Load a week of sample data** to see the workbench in full swing.'],
        ],
      },
      {
        id: 'workspace',
        title: 'Find Your Way Around',
        summary: 'What the sidebar, top bar and side panel are for.',
        minutes: 4,
        blocks: [
          ['p', 'The workbench has three parts: the sidebar on the left holds your modules, the top bar carries navigation and global tools, and the side panel brings the assistant in whenever you need it.'],
          ['figure', 'shell', 'Sidebar, top bar and side panel.'],
          ['h2', 'Sidebar'],
          ['list', [
            'Drag modules to reorder them, or into groups you create.',
            'Drag modules you rarely use to **Trash** to keep things tidy. Restore them anytime.',
            'Click the sidebar button in the top bar to shrink the sidebar to icons.',
          ]],
          ['h2', 'Top bar'],
          ['p', 'In the middle are **Home**, **Schedule** and **Support**. On the right: search, notifications, feedback, tutorial and privacy.'],
          ['h2', 'Side panel'],
          ['p', 'On pages like Question Bank and Schedule, click the side panel button at the top right and the assistant appears beside your work. It can see the question or lesson you’re looking at.'],
          ['keys', [['⌘K', 'Search questions, files and works'], ['⌘N', 'New chat with the assistant'], ['Esc', 'Close a dialog or menu']]],
        ],
      },
      {
        id: 'sample-data',
        title: 'Load Sample Data',
        summary: 'Try every feature with a sample week of classes and questions.',
        minutes: 2,
        blocks: [
          ['p', 'An empty workbench is hard to picture. Sample data adds 7 questions, 4 files and a week of classes that you can edit or delete freely.'],
          ['steps', ['Open **Home**.', 'Below the input, click **Load a week of sample data**.', 'When it’s done, take a look at **Question Bank** or **Schedule**.']],
          ['note', 'Sample data sits alongside your own content. Delete items one by one when you no longer need them.'],
        ],
      },
    ],
  },
  {
    id: 'questions',
    icon: 'book',
    hue: 'orange',
    title: 'Question Bank',
    blurb: 'Enter, import and organize questions so every good one is easy to find.',
    articles: [
      {
        id: 'enter',
        title: 'Enter a Question',
        summary: 'Write a question with text, formulas and images, then add the answer.',
        minutes: 3,
        blocks: [
          ['p', 'Entering a question by hand works best for questions you write yourself, or ones that need careful layout.'],
          ['steps', [
            'In Question Bank, click **New Question**.',
            'Write the stem. Wrap formulas in `$`, like `$y=ax^2+bx+c$`, and paste images directly.',
            'Choose a **type** and add a few **tags**, such as “Quadratics” or “Challenging”.',
            'Add the **answer** and **explanation** below, then save.',
          ]],
          ['figure', 'question', 'Editing a question: stem, answer and explanation.'],
          ['tip', 'The more specific your tags, the easier questions are to find later. A question can have several.'],
        ],
      },
      {
        id: 'import',
        title: 'Import Questions from Files',
        summary: 'Bring a whole test or handout into the bank at once.',
        minutes: 4,
        blocks: [
          ['p', 'Already have a test or handout as a file? No need to retype it. Upload it, TeachBuddy splits it into questions, and you just check them.'],
          ['steps', ['In Question Bank, click **Import** and choose a PDF or image.', 'When splitting finishes, compare each question and formula with the original.', 'For questions that look right, click **Add to Bank**.']],
          ['note', 'Recognition can make mistakes, especially with handwriting and complex formulas. Always check against the original first.'],
        ],
      },
      {
        id: 'find',
        title: 'Find, Filter and Reference Questions',
        summary: 'Search by type, tag and keyword, then bring a question into the chat.',
        minutes: 3,
        blocks: [
          ['p', 'Search at the top of Question Bank looks through stems, formulas and notes. The filter button beside it narrows results by type and tag.'],
          ['h2', 'Bring a question into the chat'],
          ['p', 'Open a question, then open the side panel, and the assistant can see it. Click **Looking at** below the input to bring it into the conversation, then ask “How should I teach this?” or “Write a variant.”'],
          ['tip', 'You can also type `@` in the assistant’s input to search for and reference a question.'],
        ],
      },
    ],
  },
  {
    id: 'schedule',
    icon: 'calendar',
    hue: 'red',
    title: 'Schedule',
    blurb: 'Classes, meetings and to-dos, all in one calendar.',
    articles: [
      {
        id: 'tasks',
        title: 'Create Tasks and Unscheduled Items',
        summary: 'Put timed things on the calendar; jot down the rest for later.',
        minutes: 3,
        blocks: [
          ['p', 'Schedule holds two kinds of things: **tasks** with a set time, and **unscheduled** items that don’t have one yet.'],
          ['steps', [
            'Drag across the calendar, or click **＋** to create a task.',
            'Add a title, plus notes and labels if you like.',
            'List small steps under **Checklist** and check them off as you go.',
            'Click **Done**. Everything saves automatically.',
          ]],
          ['figure', 'task', 'A task: time, labels and checklist.'],
          ['p', 'Thought of something but not sure when? Click **＋** in **Unscheduled** to jot it down, then **Add a time** later.'],
          ['tip', 'Mark checklist items **High** or **Later**. They show as small badges on the task board.'],
        ],
      },
      {
        id: 'repeat',
        title: 'Repeating Classes and Reminders',
        summary: 'Create a weekly class once. Reminders appear in your notifications.',
        minutes: 3,
        blocks: [
          ['p', 'A class that meets every week only needs to be created once.'],
          ['steps', ['Open the class, click **Repeat**, and choose **Weekly** or **Every weekday**.', 'For finer control, choose **Custom…** and set the interval and end date.', 'Under **Reminder**, choose how far ahead to be notified.']],
          ['p', 'To change just one class, edit that one. The other weeks stay as they are.'],
          ['note', 'Reminders appear only in TeachBuddy’s notifications. No email or text messages are sent.'],
        ],
      },
      {
        id: 'board',
        title: 'Plan Your Week on the Task Board',
        summary: 'Today, Coming up and Unscheduled at a glance.',
        minutes: 2,
        blocks: [
          ['p', 'Switch to **Task** at the top of Schedule and your week lays out in three columns: **Today**, **Coming up** and **Unscheduled**.'],
          ['list', ['Check off items right on the card without opening it.', 'Each card shows its time range and labels; important items carry a red badge.', 'Click a card to edit it in the panel on the right.']],
          ['figure', 'board', 'The task board.'],
        ],
      },
    ],
  },
  {
    id: 'assistant',
    icon: 'assistant',
    hue: 'indigo',
    title: 'Assistant',
    blurb: 'Plan lessons together; let it check your bank and schedule.',
    articles: [
      {
        id: 'plan',
        title: 'Plan a Lesson with the Assistant',
        summary: 'From teaching order to practice questions in one conversation.',
        minutes: 4,
        blocks: [
          ['p', 'Pick an upcoming lesson in the title on Home, and the suggestions below change to match it: plan the teaching order, find practice questions, design a demo, build tiered homework.'],
          ['figure', 'assistant', 'The assistant checks your bank and schedule first, then gives you results you can use.'],
          ['h2', 'Cards in an answer'],
          ['list', [
            '**Teaching order**: click **Add to Schedule** to turn it into an unscheduled item with the steps as a checklist.',
            '**Questions found**: open one in Question Bank, or add it to the chat.',
            '**Tiered practice and variants**: click **Save to Question Bank**.',
          ]],
          ['tip', 'Not quite right? Click **Regenerate** below the answer, or just tell it what to change.'],
        ],
      },
      {
        id: 'reference',
        title: 'Reference Questions, Events and Files',
        summary: 'Use @ to bring things from your workbench into the chat.',
        minutes: 2,
        blocks: [
          ['p', 'Type `@` in the input, or click the **@** button at its lower left, to search questions, events and files. Your picks appear as colored chips below the input.'],
          ['list', ['Orange is a question, indigo an event, blue a file.', 'Click **×** on a chip to remove it.']],
          ['note', 'In the side panel, the assistant suggests what you’re **Looking at**, but only brings it into the chat when you click it.'],
        ],
      },
      {
        id: 'threads',
        title: 'Manage Conversations',
        summary: 'Pin, rename and delete conversations.',
        minutes: 2,
        blocks: [
          ['p', 'All your conversations are on the left of Home, grouped by Today, Yesterday and Previous 7 days. Hover over one and click **…**:'],
          ['list', ['**Pin**: keep it at the top.', '**Rename**: give it a name that’s easy to find.', '**Delete**: click again to confirm.']],
          ['keys', [['⌘N', 'New chat']]],
        ],
      },
    ],
  },
  {
    id: 'math',
    icon: 'math',
    hue: 'purple',
    title: 'Math Workshop',
    blurb: 'Make formulas, graphs and classroom demos ready to use.',
    articles: [
      {
        id: 'create',
        title: 'Create Your First Work',
        summary: 'Formulas, functions, plane and solid figures, and demos.',
        minutes: 3,
        blocks: [
          ['p', 'Everything you make in Math Workshop is called a **work**.'],
          ['steps', ['Click **New work** and choose a type.', 'Adjust parameters and style in the tools on the right. The canvas updates as you go.', 'Give it a name and save.']],
          ['figure', 'math', 'A parabola demo: drag the slider to change a.'],
          ['tip', 'Demos shine with sliders: students see for themselves what a parameter changes.'],
        ],
      },
      {
        id: 'export',
        title: 'Export to Your Slides',
        summary: 'PNG, SVG, or HTML that opens offline.',
        minutes: 2,
        blocks: [
          ['list', ['**PNG**: paste straight into a slide.', '**SVG**: stays sharp at any size; good for printing.', '**HTML**: demos open offline and stay interactive in class.']],
          ['note', 'Open the exported file once on your own computer to check it before class.'],
        ],
      },
    ],
  },
  {
    id: 'resources',
    icon: 'folder',
    hue: 'blue',
    title: 'Resource Library',
    blurb: 'Upload, preview and reuse slides, tests and images.',
    articles: [
      {
        id: 'upload',
        title: 'Upload and Organize Files',
        summary: 'Folders and tags to organize; search to find.',
        minutes: 3,
        blocks: [
          ['steps', ['In Resource Library, click **Upload materials** and choose a file.', 'Give it a name, put it in a folder, and add tags and notes.', 'After saving, click the card to preview it or download the original.']],
          ['figure', 'resources', 'Resource Library in grid view.'],
          ['tip', 'Manage categories in one place with **Folders and tags**. Switch to list view to see more detail.'],
        ],
      },
      {
        id: 'replace',
        title: 'Replace a File',
        summary: 'Swap the file; keep its name, folder and notes.',
        minutes: 1,
        blocks: [
          ['p', 'Updated your slides? Open the file, click **Replace file**, and choose the new version. Name, folder, tags and notes all stay.'],
          ['note', 'Closed the page before an upload finished? When you come back, choose the same file again when asked, then confirm the result.'],
        ],
      },
    ],
  },
  {
    id: 'account',
    icon: 'shield',
    hue: 'green',
    title: 'Account & Data',
    blurb: 'Saving, exporting your data, appearance and language.',
    articles: [
      {
        id: 'saving',
        title: 'Saving and Version Conflicts',
        summary: 'What “Saved” means, and what to do when something changed elsewhere.',
        minutes: 3,
        blocks: [
          ['p', 'Your changes save automatically. **Saved** means the server has confirmed them.'],
          ['h2', 'Can’t confirm right now'],
          ['p', 'On a weak connection you may see **Can’t confirm whether this was saved**. Click **Retry confirmation** first. TeachBuddy checks the original request, so nothing is created twice.'],
          ['h2', 'Changed somewhere else'],
          ['p', 'If the same item was edited on another device, you’ll see a conflict. Look at the server’s version first, then decide which to keep. Copy any local text you want to hold on to.'],
          ['note', 'Don’t clear your browser data to fix saving problems. You’ll lose drafts that haven’t been saved yet.'],
        ],
      },
      {
        id: 'export',
        title: 'Export and Delete Your Data',
        summary: 'Take everything with you, or delete your account.',
        minutes: 2,
        blocks: [
          ['steps', ['Open **Settings** and click **Export data** in the **Your data** row.', 'When the package is ready, click **Download**, unzip it and open `index.html`.', 'Delete packages you no longer need with the trash button beside them.']],
          ['p', 'To delete your account, click **Delete Account…** in the **Danger Zone** at the bottom of Settings and confirm with your email. This can’t be undone.'],
          ['note', 'Files you’ve already downloaded stay on your computer after your account is deleted.'],
        ],
      },
      {
        id: 'appearance',
        title: 'Appearance, Language and Background',
        summary: 'Light or dark, Chinese or English, and a background of your own.',
        minutes: 2,
        blocks: [
          ['p', 'In **Settings**:'],
          ['list', ['**Appearance**: Light or Dark.', '**Language**: 简体中文 or English. The interface switches right away.', '**Content background**: Grid, Parchment, Circles, or click **Custom** to upload your own picture.']],
          ['tip', 'A custom background gets a soft veil of the canvas color so text always stays readable.'],
        ],
      },
    ],
  },
];

export const HOME = {
  featured: [['start', 'welcome'], ['assistant', 'plan'], ['questions', 'import']],
  popular: [['schedule', 'repeat'], ['account', 'saving'], ['math', 'export'], ['questions', 'find'], ['account', 'export']],
  searches: ['repeat', 'export', 'formula', 'reminder', 'import'],
};
