import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Trash2, Plus, LogOut, ArrowRight, AlertCircle, Clock, MapPin, Pencil, X } from 'lucide-react';
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
  const [newTaskCategory, setNewTaskCategory] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskUnit, setNewTaskUnit] = useState('dias');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

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
      // Ordenar por fecha de creación
      tasksData.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setTasks(tasksData);
      setIsLoadingData(false);
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
    if (!newTaskName || !newTaskTime) return;
    
    const timeVal = parseFloat(newTaskTime);
    // Asumimos 8 horas de trabajo por día para el cálculo general
    const daysCalculated = newTaskUnit === 'horas' ? timeVal / 8 : timeVal;

    if (editingTaskId) {
      await updateDoc(doc(db, 'tasks', editingTaskId), {
        name: newTaskName,
        category: newTaskCategory || 'General',
        timeValue: timeVal,
        timeUnit: newTaskUnit,
        days: daysCalculated
      });
      setEditingTaskId(null);
    } else {
      await addDoc(collection(db, 'tasks'), {
        name: newTaskName,
        category: newTaskCategory || 'General',
        timeValue: timeVal,
        timeUnit: newTaskUnit,
        days: daysCalculated,
        completed: false,
        createdAt: new Date().toISOString()
      });
    }
    
    setNewTaskName('');
    setNewTaskTime('');
    setNewTaskCategory('');
    setNewTaskUnit('dias');
  };

  const startEditing = (task) => {
    setEditingTaskId(task.id);
    setNewTaskName(task.name);
    setNewTaskCategory(task.category === 'General' ? '' : task.category);
    setNewTaskTime(task.timeValue);
    setNewTaskUnit(task.timeUnit);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setNewTaskName('');
    setNewTaskTime('');
    setNewTaskCategory('');
    setNewTaskUnit('dias');
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
  const totalEstimatedDays = pendingTasks.reduce((sum, t) => sum + (t.days || 0), 0);
  
  const isValidDate = targetDate && remainingCalendarDays >= 0;
  const isOnTrack = totalEstimatedDays <= remainingCalendarDays;

  // Agrupar tareas por categoría
  const groupedTasks = tasks.reduce((acc, task) => {
    const cat = task.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(task);
    return acc;
  }, {});

  // Extraer categorías únicas para el datalist
  const uniqueCategories = Array.from(new Set(tasks.map(t => t.category).filter(Boolean)));

  if (isAuthLoading) {
    return (
      <div className="login-wrapper">
        <div className="glass-panel login-box animate-fade-in">
          <div className="skeleton mx-auto" style={{ height: '2rem', width: '60%', marginBottom: '1rem' }}></div>
          <div className="skeleton mx-auto" style={{ height: '1.2rem', width: '80%', marginBottom: '2rem' }}></div>
          <div className="skeleton" style={{ height: '3.5rem', marginBottom: '1rem' }}></div>
          <div className="skeleton" style={{ height: '3.5rem', marginBottom: '1rem' }}></div>
          <div className="skeleton" style={{ height: '3.5rem' }}></div>
        </div>
      </div>
    );
  }

  if (isAuthenticated && isLoadingData) {
    return (
      <div className="container animate-fade-in">
        <header className="flex justify-between items-center mb-4">
          <div className="skeleton" style={{ width: '200px', height: '2.5rem' }}></div>
          <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '8px' }}></div>
        </header>
        
        <div className="glass-panel mb-4">
          <div className="skeleton" style={{ height: '2rem', width: '40%', marginBottom: '1rem' }}></div>
          <div className="skeleton" style={{ height: '1.2rem', width: '60%', marginBottom: '1.5rem' }}></div>
          <div className="skeleton" style={{ height: '3.5rem' }}></div>
        </div>
        
        <div className="status-grid">
          <div className="glass-panel skeleton" style={{ height: '150px' }}></div>
          <div className="glass-panel skeleton" style={{ height: '150px' }}></div>
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
            
            <button type="submit" className="mt-2" style={{width: '100%'}}>
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
          <form onSubmit={handleSetDate} className="flex gap-2 date-form">
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
          
          {/* 1. SECCIÓN DE TAREAS (AHORA ARRIBA) */}
          <div className="glass-panel animate-fade-in delay-1">
            <h2 className="text-2xl mb-2 flex items-center gap-1">
              <Clock size={24} className="text-primary" /> Cosas que faltan hacer
            </h2>
            
            <form onSubmit={addTask} className="flex gap-2 mb-4 task-form" style={{flexWrap: 'wrap'}}>
              <input 
                type="text" 
                placeholder="¿Qué falta hacer?" 
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                className="flex-1"
                required
              />
              <div className="flex-1" style={{position: 'relative', minWidth: '150px'}}>
                <input 
                  type="text" 
                  placeholder="Ambiente (ej: Baño)" 
                  value={newTaskCategory}
                  onChange={(e) => {
                    setNewTaskCategory(e.target.value);
                    setShowCategoryDropdown(true);
                  }}
                  onFocus={() => setShowCategoryDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                  className="w-full"
                />
                {showCategoryDropdown && uniqueCategories.filter(cat => cat.toLowerCase().includes(newTaskCategory.toLowerCase())).length > 0 && (
                  <ul className="custom-dropdown">
                    {uniqueCategories
                      .filter(cat => cat.toLowerCase().includes(newTaskCategory.toLowerCase()))
                      .map(cat => (
                        <li 
                          key={cat} 
                          onClick={() => {
                            setNewTaskCategory(cat);
                            setShowCategoryDropdown(false);
                          }}
                        >
                          {cat}
                        </li>
                    ))}
                  </ul>
                )}
              </div>

              <input 
                type="number" 
                placeholder="Tiempo" 
                value={newTaskTime}
                onChange={(e) => setNewTaskTime(e.target.value)}
                min="0.1"
                step="0.1"
                className="w-24"
                required
              />
              <select 
                value={newTaskUnit} 
                onChange={(e) => setNewTaskUnit(e.target.value)}
                className="select-unit"
              >
                <option value="dias">Días</option>
                <option value="horas">Horas</option>
              </select>

              {editingTaskId ? (
                <div className="flex gap-2 shrink-0 w-full-mobile">
                  <button type="submit" className="flex-1">
                    Guardar
                  </button>
                  <button type="button" className="danger flex-1" onClick={cancelEditing}>
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <button type="submit" className="shrink-0 w-full-mobile">
                  <Plus size={20} /> Agregar
                </button>
              )}
            </form>

            <div className="mt-4">
              {tasks.length === 0 ? (
                <div className="text-center text-muted mt-4">
                  No hay tareas cargadas todavía. ¡Agrega la primera!
                </div>
              ) : (
                <div className="flex-col gap-4">
                  {Object.entries(groupedTasks).map(([category, catTasks]) => (
                    <div key={category} className="category-group">
                      <h3 className="text-xl text-primary font-bold mb-2 flex items-center gap-1 border-b pb-1">
                        <MapPin size={20} /> {category}
                      </h3>
                      <ul className="task-list">
                        {catTasks.map(task => (
                          <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                            <div className="flex items-center gap-2">
                              <button 
                                className="icon-btn" 
                                onClick={() => toggleTask(task)}
                                style={{color: task.completed ? 'var(--success)' : 'var(--text-muted)'}}
                                title={task.completed ? "Marcar como en proceso" : "Marcar como finalizada"}
                              >
                                <CheckCircle size={24} />
                              </button>
                              <div className="flex-col justify-center">
                                <span className="text-xl task-name">{task.name}</span>
                                <span style={{
                                  fontSize: '0.85rem', 
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  marginTop: '2px',
                                  color: task.completed ? 'var(--success)' : '#F59E0B'
                                }}>
                                  {task.completed ? '✓ Finalizada' : '⏳ En proceso'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="task-actions flex items-center gap-2">
                              <span className="task-days" title={`${(task.days || 0).toFixed(1)} días calculados de trabajo`}>
                                {task.timeValue} {task.timeUnit}
                              </span>
                              <button className="icon-btn" onClick={() => startEditing(task)} title="Editar tarea">
                                <Pencil size={20} />
                              </button>
                              <button className="icon-btn danger" onClick={() => deleteTask(task.id)} title="Borrar tarea">
                                <Trash2 size={20} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. DASHBOARD DE ESTADO (AHORA ABAJO) */}
          <div className="status-grid animate-fade-in delay-2">
            <div className="glass-panel status-card">
              <Calendar size={32} className="text-primary mb-2" />
              <div className="text-muted text-xl">Días Calendario</div>
              <div className="text-4xl font-bold mt-2">
                {remainingCalendarDays > 0 ? remainingCalendarDays : 0}
              </div>
              <div className="text-muted mt-2" style={{fontSize: '0.9rem'}}>
                Hasta el {format(parseISO(targetDate), "d 'de' MMMM, yyyy", { locale: es })}
              </div>
              <button 
                className="icon-btn mt-2" 
                style={{fontSize: '0.9rem'}}
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
              <div className="text-4xl font-bold mt-2">{Math.ceil(totalEstimatedDays)}</div>
              
              <div className="mt-2 font-bold text-xl">
                {!isValidDate ? (
                  <span className="text-danger">Fecha vencida</span>
                ) : (
                  isOnTrack ? '¡LLEGAMOS BIEN!' : '¡NO LLEGAMOS, REORGANIZAR!'
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
