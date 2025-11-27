const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

createApp({
  setup() {
    const K = {
      prefs: 'gym_prefs',
      videos: 'gym_videos',
      notes: 'gym_notes',
      trainText: 'gym_traintext',
      logs: 'gym_logs',
    };

    const prefs = reactive({ interval: 60, part: 'legs', customParts: [] });
    const videos = reactive({
      legs: [],
      chest: [],
      back: [],
      shoulders: [],
      arms: [],
      core: [],
    });
    const notes = reactive({});
    const trainText = reactive({});
    const logs = ref([]);

    const currentTab = ref('home');
    const workoutSubTab = ref('记录');
    const showLogModal = ref(false);
    const showCustomPartModal = ref(false);
    const expandedLogId = ref(null);

    const fixLogs = (loadedLogs) => {
      if (!Array.isArray(loadedLogs)) return [];
      return loadedLogs.map((log) => {
        if (!log.ts || isNaN(new Date(log.ts).getTime())) {
          log.ts = Date.now();
        }
        return log;
      });
    };

    const load = () => {
      try {
        const p = JSON.parse(localStorage.getItem(K.prefs));
        if (p) Object.assign(prefs, p);

        const v = JSON.parse(localStorage.getItem(K.videos));
        if (v) Object.assign(videos, v);

        const n = JSON.parse(localStorage.getItem(K.notes));
        if (n) Object.assign(notes, n);

        const t = JSON.parse(localStorage.getItem(K.trainText));
        if (t) Object.assign(trainText, t);

        let l = JSON.parse(localStorage.getItem(K.logs));
        if (l) logs.value = fixLogs(l);
      } catch (e) {
        console.error('load error', e);
      }
    };

    const saveAll = () => {
      localStorage.setItem(K.prefs, JSON.stringify(prefs));
      localStorage.setItem(K.videos, JSON.stringify(videos));
      localStorage.setItem(K.notes, JSON.stringify(notes));
      localStorage.setItem(K.trainText, JSON.stringify(trainText));
      localStorage.setItem(K.logs, JSON.stringify(logs.value));
    };

    onMounted(load);
    watch([prefs, videos, notes, trainText, logs], () => {
      setTimeout(saveAll, 500);
    }, { deep: true });

    // 1. 基础部位
    const baseParts = [
      { id: 'legs', name: '腿部' },
      { id: 'chest', name: '胸部' },
      { id: 'back', name: '背部' },
      { id: 'shoulders', name: '肩部' },
      { id: 'arms', name: '手臂' },
      { id: 'core', name: '核心' },
    ];

    // 2. 全部部位（包含自定义）
    const allParts = computed(() => [
      ...baseParts,
      ...prefs.customParts.map((p) => ({ id: 'c_' + p, name: p })),
    ]);

    const selectPart = (id) => {
      prefs.part = id;
    };

    const getPartName = (id) => {
      return (allParts.value.find((p) => p.id === id) || { name: '未知' }).name;
    };

    // 图标映射
    const getPartIcon = (name) => {
      if (!name) return 'ri-question-line';
      const n = name.toLowerCase();

      if (n.includes('腿部')) return 'ri-walk-fill';
      if (n.includes('胸部')) return 'ri-t-shirt-air-fill';
      if (n.includes('背部')) return 'ri-align-vertically';
      if (n.includes('肩部')) return 'ri-medal-fill';
      if (n.includes('手臂')) return 'ri-boxing-fill';
      if (n.includes('核心')) return 'ri-shape-2-fill';

      if (n.includes('小腿')) return 'ri-footprint-fill';
      if (n.includes('大腿')) return 'ri-run-fill';
      if (n.includes('二头')) return 'ri-flashlight-fill';
      if (n.includes('屁股') || n.includes('臀')) return 'ri-moon-fill';

      return 'ri-star-smile-fill';
    };

    // 自定义部位
    const newCustomPartName = ref('');
    const addCustomPart = () => {
      if (!newCustomPartName.value) return;
      const name = newCustomPartName.value.trim();
      if (!name) return;
      prefs.customParts.push(name);
      videos['c_' + name] = [];
      newCustomPartName.value = '';
    };
    const removeCustomPart = (i) => {
      prefs.customParts.splice(i, 1);
    };

    // 计时器
    const timer = ref(60);
    const isRunning = ref(false);
    let intervalId = null;

    const formatTime = (s) => {
      const m = Math.floor(s / 60)
        .toString()
        .padStart(2, '0');
      const sec = (s % 60).toString().padStart(2, '0');
      return `${m}:${sec}`;
    };

    const startTimer = () => {
      if (isRunning.value) return;
      isRunning.value = true;
      if (timer.value === 0) timer.value = prefs.interval;
      intervalId = setInterval(() => {
        if (timer.value > 0) {
          timer.value--;
        } else {
          resetTimer();
          try {
            const audio = document.getElementById('beepAudio');
            if (audio) audio.play().catch(() => {});
          } catch (e) {}
          alert('时间到!');
        }
      }, 1000);
    };

    const resetTimer = () => {
      isRunning.value = false;
      clearInterval(intervalId);
      timer.value = prefs.interval;
    };

    const toggleTimer = () => {
      if (isRunning.value) {
        isRunning.value = false;
        clearInterval(intervalId);
      } else {
        startTimer();
      }
    };

    // 文本/训练内容
    const currentTrainText = computed({
      get: () => (trainText[prefs.part]?.all || ''),
      set: (v) => {
        if (!trainText[prefs.part]) trainText[prefs.part] = {};
        trainText[prefs.part].all = v;
      },
    });

    const saveTrainText = () => {
      saveAll();
    };

    const currentPartVideos = computed(() => videos[prefs.part] || []);
    const selectedVideoIndex = ref(-1);
    const currentVideo = computed(() => {
      if (selectedVideoIndex.value >= 0) {
        return currentPartVideos.value[selectedVideoIndex.value];
      }
      return currentPartVideos.value.length
        ? currentPartVideos.value[0]
        : null;
    });

    const isLink = (url) => url && url.startsWith('http');

    const openVideoLink = (url) => {
      if (!url) return;
      window.open(url, '_blank');
    };

    const getEmbedUrl = (url) => {
      if (!url) return '';
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const regExp =
          /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
        const match = url.match(regExp);
        const id = match && match[2].length === 11 ? match[2] : null;
        if (id) {
          return `https://www.youtube.com/embed/${id}?rel=0&playsinline=1`;
        }
      }
      return url;
    };

    const cleanText = (text) => {
      if (!text) return '';
      return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join('\n');
    };

    const handlePaste = () => {
      setTimeout(() => {
        currentTrainText.value = cleanText(currentTrainText.value);
        saveAll();
      }, 100);
    };

    const formatTextManual = () => {
      currentTrainText.value = cleanText(currentTrainText.value);
      saveAll();
    };

    // 日志
    const sortedLogs = computed(() =>
      [...logs.value].sort((a, b) => b.ts - a.ts),
    );

    const getDateParts = (ts) => {
      const date = new Date(Number(ts));
      if (isNaN(date.getTime())) {
        return { month: '--', day: '--' };
      }
      return {
        month: date
          .toLocaleDateString('en-US', { month: 'short' })
          .toUpperCase(),
        day: date.getDate(),
      };
    };

    const toggleLogExpand = (id) => {
      expandedLogId.value =
        expandedLogId.value === id ? null : id;
    };

    const logForm = reactive({
      id: null,
      part: '',
      title: '',
      content: '',
    });

    const openLogModal = (log) => {
      if (log) {
        Object.assign(logForm, log);
      } else {
        logForm.id = null;
        logForm.part = prefs.part;
        logForm.title = '';
        logForm.content = '';
      }
      showLogModal.value = true;
    };

    const saveLog = () => {
      const payload = {
        title: logForm.title || '训练记录',
        content: logForm.content,
        part: logForm.part,
        ts: Date.now(),
      };
      if (logForm.id) {
        const idx = logs.value.findIndex(
          (l) => l.id === logForm.id,
        );
        if (idx !== -1) {
          Object.assign(logs.value[idx], payload);
        }
      } else {
        logs.value.push({
          id: Date.now().toString(),
          ...payload,
        });
      }
      showLogModal.value = false;
      saveAll();
    };

    const deleteLog = (id) => {
      if (!confirm('删除?')) return;
      logs.value = logs.value.filter((l) => l.id !== id);
      saveAll();
    };

    // 视频设置
    const settingsPart = ref('legs');
    const videoForm = reactive({
      name: '',
      url: '',
      index: -1,
    });
    const isEditingVideo = computed(() => videoForm.index >= 0);

    const editVideo = (i) => {
      const v = videos[settingsPart.value][i];
      videoForm.name = v.name;
      videoForm.url = v.url;
      videoForm.index = i;
    };

    const cancelEditVideo = () => {
      videoForm.name = '';
      videoForm.url = '';
      videoForm.index = -1;
    };

    const saveVideo = () => {
      if (!videoForm.name || !videoForm.url) return;
      if (!videos[settingsPart.value]) {
        videos[settingsPart.value] = [];
      }
      if (isEditingVideo.value) {
        videos[settingsPart.value][videoForm.index] = {
          name: videoForm.name,
          url: videoForm.url,
        };
      } else {
        videos[settingsPart.value].push({
          name: videoForm.name,
          url: videoForm.url,
        });
      }
      cancelEditVideo();
      saveAll();
    };

    const deleteVideo = (i) => {
      if (!confirm('删除?')) return;
      videos[settingsPart.value].splice(i, 1);
      saveAll();
    };

    // 备份 / 恢复 / 清空
    const saveJson = () => {
      const data = {
        prefs,
        videos,
        notes,
        trainText,
        logs: logs.value,
      };
      const blob = new Blob([JSON.stringify(data)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const loadJson = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          Object.assign(prefs, data.prefs || {});
          Object.assign(videos, data.videos || {});
          Object.assign(notes, data.notes || {});
          Object.assign(trainText, data.trainText || {});
          logs.value = fixLogs(data.logs || []);
          alert('恢复成功');
        } catch (err) {
          console.error(err);
          alert('备份文件格式错误');
        }
      };
      reader.readAsText(file);
    };

    const wipeAll = () => {
      if (!confirm('清空?')) return;
      localStorage.clear();
      location.reload();
    };

    const navItems = [
      { id: 'home', name: '首页', icon: 'ri-home-5-line' },
      { id: 'workout', name: '训练', icon: 'ri-timer-flash-line' },
      { id: 'logs', name: '日志', icon: 'ri-file-list-3-line' },
      { id: 'settings', name: '设置', icon: 'ri-settings-4-line' },
    ];

    return {
      prefs,
      videos,
      notes,
      trainText,
      logs,
      currentTab,
      navItems,
      workoutSubTab,
      timer,
      isRunning,
      allParts,
      selectPart,
      getPartName,
      getPartIcon,
      startTimer,
      resetTimer,
      toggleTimer,
      formatTime,
      currentTrainText,
      saveTrainText,
      currentPartVideos,
      selectedVideoIndex,
      currentVideo,
      isLink,
      getEmbedUrl,
      openVideoLink,
      sortedLogs,
      expandedLogId,
      toggleLogExpand,
      showLogModal,
      openLogModal,
      saveLog,
      deleteLog,
      logForm,
      settingsPart,
      videoForm,
      isEditingVideo,
      editVideo,
      cancelEditVideo,
      saveVideo,
      deleteVideo,
      showCustomPartModal,
      newCustomPartName,
      addCustomPart,
      removeCustomPart,
      saveJson,
      loadJson,
      wipeAll,
      saveAll,
      handlePaste,
      formatTextManual,
      getDateParts,
    };
  },
}).mount('#app');
