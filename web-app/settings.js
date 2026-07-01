/*jslint browser */

const player0_input = document.getElementById("player0_name");
const player1_input = document.getElementById("player1_name");
const save_btn = document.getElementById("save_btn");
const save_msg = document.getElementById("save_msg");

// Load saved names on page open.
player0_input.value = localStorage.getItem("azul_player0") || "";
player1_input.value = localStorage.getItem("azul_player1") || "";

save_btn.onclick = function () {
    localStorage.setItem("azul_player0", player0_input.value.trim() || "Player 1");
    localStorage.setItem("azul_player1", player1_input.value.trim() || "Player 2");
    save_msg.textContent = "Settings saved!";
    setTimeout(function () {
        save_msg.textContent = "";
    }, 2000);
};
