@echo off
echo Starting backend (http://localhost:8000) and frontend (http://localhost:4200)...
start "Opportunity Map - Backend" /D "%~dp0backend-node" cmd /k npm start
start "Opportunity Map - Frontend" /D "%~dp0frontend" cmd /k npm start
