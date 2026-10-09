import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Trash2, Plus, LogOut, ArrowRight, AlertCircle, Clock } from 'lucide-react';
import { differenceInDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from './firebase';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [targetDate, setTargetDate] = useState(null);
  const [inputDate, setInputDate] = useState('');

  const [tasks, setTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDays, setNewTaskDays] = useState('');

  // Sincronizar estado de autenticación con Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(false);
    try {
      // Convertimos el usuario a formato email internamente para Firebase
      const email = username === 'chajari' ? 'chajari@agenda.com' : `${username}`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error de login:", error);
      setLoginError(true);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUsername('');
    setPassword('');
  };

  // Cargar datos de Firebase al autenticarse
  useEffect(() => {
    if (!isAuthenticated) return;

    // Suscripción a tareas
    const tasksRef = collection(db, 'tasks');
    const unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Ordenar por fecha de creación localmente para simplificar sin requerir índices compuestos
      tasksData.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setTasks(tasksData);
    });

    // Suscripción a fecha objetivo
    const configRef = doc(db, 'settings', 'config');
    const unsubscribeConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().targetDate) {
        setTargetDate(docSnap.data().targetDate);
      } else {
        setTargetDate(null);
      }
    });

    return () => {
      unsubscribeTasks();
      unsubscribeConfig();
    };
  }, [isAuthenticated]);

  const handleSetDate = async (e) => {
    e.preventDefault();
    if (inputDate) {
      await setDoc(doc(db, 'settings', 'config'), { targetDate: inputDate }, { merge: true });
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskName || !newTaskDays) return;

    await addDoc(collection(db, 'tasks'), {
      name: newTaskName,
      days: parseInt(newTaskDays, 10),
      completed: false,
      createdAt: new Date().toISOString()
    });

    setNewTaskName('');
    setNewTaskDays('');
  };

  const toggleTask = async (task) => {
    await updateDoc(doc(db, 'tasks', task.id), {
      completed: !task.completed
    });
  };

  const deleteTask = async (id) => {
    await deleteDoc(doc(db, 'tasks', id));
  };

  const clearTargetDate = async () => {
    await setDoc(doc(db, 'settings', 'config'), { targetDate: null }, { merge: true });
  }

  // Calculations
  const today = new Date();
  const remainingCalendarDays = targetDate ? differenceInDays(parseISO(targetDate), today) : 0;

  const pendingTasks = tasks.filter(t => !t.completed);
  const totalEstimatedDays = pendingTasks.reduce((sum, t) => sum + t.days, 0);

  const isValidDate = targetDate && remainingCalendarDays >= 0;
  const isOnTrack = totalEstimatedDays <= remainingCalendarDays;

  if (isAuthLoading) {
    return (
      <div className="login-wrapper">
        <div className="text-center text-muted animate-fade-in">
          <h2 className="text-2xl">Conectando...</h2>
        </div>
      </div>
    );
  }

  // Pantalla de Login
  if (!isAuthenticated) {
    return (
      <div className="login-wrapper">
        <div className="glass-panel login-box animate-fade-in">
          <div className="text-center mb-2">
            <h1 className="text-3xl mb-2">Agenda de Obra</h1>
            <p className="text-muted">Ingresa para administrar tu proyecto</p>
          </div>

          <form onSubmit={handleLogin} className="flex-col gap-2 mt-4">
            <div>
              <input
                type="text"
                placeholder="Usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {loginError && (
              <div className="text-danger text-center font-bold">
                Credenciales incorrectas.
              </div>
            )}

            <button type="submit" className="mt-2" style={{ width: '100%' }}>
              Ingresar <ArrowRight size={20} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in">
      <header className="flex justify-between items-center mb-2">
        <h1 className="text-3xl">Mi Casa 2026</h1>
        <button className="icon-btn" onClick={handleLogout} title="Cerrar sesión">
          <LogOut size={24} />
        </button>
      </header>

      {!targetDate ? (
        <div className="glass-panel animate-fade-in delay-1 mt-4">
          <h2 className="text-2xl mb-2 flex items-center gap-1">
            <Calendar size={28} className="text-primary" />
            ¿Para cuándo quieres terminar la obra?
          </h2>
          <p className="text-muted mb-2">
            Ingresa la fecha estimada de finalización para que podamos calcular si llegas con los tiempos.
          </p>
          <form onSubmit={handleSetDate} className="flex gap-2">
            <input
              type="date"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              min={format(today, 'yyyy-MM-dd')}
              required
            />
            <button type="submit">Establecer Fecha</button>
          </form>
        </div>
      ) : (
        <div className="flex-col gap-4 mt-4">

          {/* Dashboard de estado */}
          <div className="status-grid animate-fade-in delay-1">
            <div className="glass-panel status-card">
              <Calendar size={32} className="text-primary mb-2" />
              <div className="text-muted text-xl">Días Disponibles</div>
              <div className="text-4xl font-bold mt-2">
                {remainingCalendarDays > 0 ? remainingCalendarDays : 0}
              </div>
              <div className="text-muted mt-2" style={{ fontSize: '0.9rem' }}>
                Hasta el {format(parseISO(targetDate), "d 'de' MMMM, yyyy", { locale: es })}
              </div>
              <button
                className="icon-btn mt-2"
                style={{ fontSize: '0.9rem' }}
                onClick={clearTargetDate}
              >
                Cambiar fecha
              </button>
            </div>

            <div className={`glass-panel status-card ${!isValidDate ? '' : (isOnTrack ? 'status-llegamos' : 'status-nollegamos')}`}>
              {isValidDate && isOnTrack ? (
                <CheckCircle size={32} className="text-success mb-2" />
              ) : (
                <AlertCircle size={32} className="text-danger mb-2" />
              )}
              <div className="text-muted text-xl">Días de Trabajo (Pendiente)</div>
              <div className="text-4xl font-bold mt-2">{totalEstimatedDays}</div>

              <div className="mt-2 font-bold text-xl">
                {!isValidDate ? (
                  <span className="text-danger">Fecha vencida</span>
                ) : (
                  isOnTrack ? '¡LLEGAMOS BIEN!' : '¡NO LLEGAMOS, REORGANIZAR!'
                )}
              </div>
            </div>
          </div>

          {/* Agregar y Listar Tareas */}
          <div className="glass-panel animate-fade-in delay-2">
            <h2 className="text-2xl mb-2 flex items-center gap-1">
              <Clock size={24} /> Cosas que faltan hacer
            </h2>

            <form onSubmit={addTask} className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="¿Qué falta hacer? Ej: Pintar living"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                style={{ flex: '1 1 300px' }}
                required
              />
              <input
                type="number"
                placeholder="Días"
                value={newTaskDays}
                onChange={(e) => setNewTaskDays(e.target.value)}
                min="1"
                style={{ flex: '0 0 100px' }}
                required
              />
              <button type="submit" style={{ flex: '0 0 120px' }}>
                <Plus size={20} /> Agregar
              </button>
            </form>

            <div className="mt-4">
              {tasks.length === 0 ? (
                <div className="text-center text-muted mt-4">
                  No hay tareas cargadas todavía. ¡Agrega la primera!
                </div>
              ) : (
                <ul className="task-list">
                  {tasks.map(task => (
                    <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                      <div className="flex items-center gap-2">
                        <button
                          className="icon-btn"
                          onClick={() => toggleTask(task)}
                          style={{ color: task.completed ? 'var(--success)' : 'var(--text-muted)' }}
                          title={task.completed ? "Marcar como pendiente" : "Marcar como lista"}
                        >
                          <CheckCircle size={24} />
                        </button>
                        <span className="text-xl task-name">{task.name}</span>
                      </div>

                      <div className="task-actions flex items-center gap-2">
                        <span className="task-days">{task.days} {task.days === 1 ? 'día' : 'días'}</span>
                        <button className="icon-btn danger" onClick={() => deleteTask(task.id)} title="Borrar tarea">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
