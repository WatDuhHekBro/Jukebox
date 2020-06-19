const express = require("express");
express().use(express.static("src")).listen(80);