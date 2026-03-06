let timer
let seconds = 0

setTimeout(()=>{
document.getElementById("intro").style.display="none"
},2000)

function login(){

let user = document.getElementById("username").value
let pass = document.getElementById("password").value

if(user=="" || pass==""){
alert("Enter details")
return
}

localStorage.setItem("user",user)
localStorage.setItem("pass",pass)

document.getElementById("loginPage").style.display="none"
document.getElementById("app").style.display="block"

loadTasks()

}

function logout(){

location.reload()

}

function startTimer(){

timer=setInterval(()=>{

seconds++

updateTime()

updateStreak()

},1000)

}

function pauseTimer(){

clearInterval(timer)

}

function resetTimer(){

clearInterval(timer)

seconds=0

updateTime()

}

function updateTime(){

let h=Math.floor(seconds/3600)
let m=Math.floor((seconds%3600)/60)
let s=seconds%60

document.getElementById("time").innerText=
h.toString().padStart(2,"0")+":"+
m.toString().padStart(2,"0")+":"+
s.toString().padStart(2,"0")

}

function updateStreak(){

let total = localStorage.getItem("study") || 0

total++

localStorage.setItem("study",total)

document.getElementById("streak").innerText =
Math.floor(total/3600)

}

function addTask(){

let task=document.getElementById("taskInput").value

let tasks=JSON.parse(localStorage.getItem("tasks"))||[]

tasks.push({name:task,done:false})

localStorage.setItem("tasks",JSON.stringify(tasks))

loadTasks()

}

function loadTasks(){

let tasks=JSON.parse(localStorage.getItem("tasks"))||[]

let list=document.getElementById("taskList")

list.innerHTML=""

tasks.forEach((t,i)=>{

let li=document.createElement("li")

li.innerHTML=`
${t.name}
<button onclick="completeTask(${i})">Done</button>
`

list.appendChild(li)

})

}

function completeTask(i){

let tasks=JSON.parse(localStorage.getItem("tasks"))

tasks[i].done=true

localStorage.setItem("tasks",JSON.stringify(tasks))

loadTasks()

}

window.onload=()=>{

document.getElementById("app").style.display="none"

let total = localStorage.getItem("study") || 0

document.getElementById("streak").innerText =
Math.floor(total/3600)

}
