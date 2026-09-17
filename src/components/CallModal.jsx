import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  serverTimestamp, 
  updateDoc 
} from "firebase/firestore";
import { FiPhoneOff, FiPhone, FiMic, FiMicOff, FiUser, FiVideo, FiVideoOff } from "react-icons/fi";
import "../App.css";

const servers = {
  iceServers: [
    { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] }
  ]
};

const CallModal = ({ roomId, currentUserUid, callType, incomingCallData, onClose }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(!incomingCallData);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const pc = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const isMounted = useRef(true);
  const hasSetRemoteDesc = useRef(false);
  const candidateQueue = useRef([]);

  const callDocRef = doc(db, "rooms", roomId, "calls", "currentCall");
  const callerCandidatesCollection = collection(callDocRef, "callerCandidates");
  const calleeCandidatesCollection = collection(callDocRef, "calleeCandidates");

  // Ringback Tone
  useEffect(() => {
    const shouldRing = (!incomingCallData && !isAnswered) || (incomingCallData && !hasAccepted);
    if (!shouldRing) return;

    let stopAudio = null;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();

        const playRingTone = () => {
          if (ctx.state === "suspended") ctx.resume();
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.frequency.value = 440;
          osc2.frequency.value = 480;

          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start();
          osc2.start();
          osc1.stop(ctx.currentTime + 1.5);
          osc2.stop(ctx.currentTime + 1.5);
        };

        playRingTone();
        const interval = setInterval(playRingTone, 3000);

        stopAudio = () => {
          clearInterval(interval);
          if (ctx.state !== "closed") ctx.close();
        };
      }
    } catch (e) {
      console.error("Audio Context Error:", e);
    }

    return () => {
      if (stopAudio) stopAudio();
    };
  }, [incomingCallData, isAnswered, hasAccepted]);

  useEffect(() => {
    isMounted.current = true;
    
    if (!incomingCallData) {
      setupCallerWebRTC();
    } else {
      const unsub = onSnapshot(callDocRef, (snap) => {
        if (snap.exists() && snap.data()?.status === "ended") {
          hangUp(false);
        }
      });
      return () => unsub();
    }

    return () => {
      isMounted.current = false;
      cleanupConnection();
    };
  }, []);

  useEffect(() => {
    if (remoteStream) {
      if (callType === "video" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream, callType, hasAccepted]);

  const createPeerConnection = () => {
    pc.current = new RTCPeerConnection(servers);
    pc.current.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };
  };

  const getMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === "video",
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
      });
      if (!isMounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      setLocalStream(stream);
      if (callType === "video" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error("Camera/Microphone access error:", err);
      alert("Microphone or Camera access failed!");
      onClose();
      return null;
    }
  };

  const addCandidateSafely = async (candidateData) => {
    if (!candidateData || !candidateData.candidate || !pc.current) return;
    if (pc.current.signalingState === "closed") return;

    try {
      if (pc.current.remoteDescription && pc.current.remoteDescription.type) {
        await pc.current.addIceCandidate(new RTCIceCandidate(candidateData));
      } else {
        candidateQueue.current.push(candidateData);
      }
    } catch (e) {
      // Ignore duplicate candidate errors
    }
  };

  // --- CALLER FLOW ---
  const setupCallerWebRTC = async () => {
    createPeerConnection();
    const stream = await getMediaStream();
    if (!stream || !pc.current) return;

    stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));

    pc.current.onicecandidate = (e) => {
      if (e.candidate && isMounted.current) {
        addDoc(callerCandidatesCollection, e.candidate.toJSON());
      }
    };

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);

    await setDoc(callDocRef, {
      offer: { type: offer.type, sdp: offer.sdp },
      callerId: currentUserUid,
      callType: callType,
      status: "calling"
    });

    onSnapshot(callDocRef, async (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();

      if (
        pc.current &&
        !hasSetRemoteDesc.current &&
        pc.current.signalingState === "have-local-offer" &&
        data?.answer
      ) {
        hasSetRemoteDesc.current = true;
        try {
          await pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          setIsAnswered(true);

          while (candidateQueue.current.length > 0) {
            const cand = candidateQueue.current.shift();
            await addCandidateSafely(cand);
          }
        } catch (err) {
          console.error("Error setting remote answer:", err);
          hasSetRemoteDesc.current = false;
        }
      }

      if (data?.status === "ended") {
        hangUp(false);
      }
    });

    onSnapshot(calleeCandidatesCollection, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          addCandidateSafely(change.doc.data());
        }
      });
    });
  };

  // --- RECEIVER ACCEPT FLOW ---
  const acceptCall = async () => {
    setHasAccepted(true);
    setIsAnswered(true);

    createPeerConnection();
    const stream = await getMediaStream();
    if (!stream || !pc.current) return;

    stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));

    pc.current.onicecandidate = (e) => {
      if (e.candidate && isMounted.current) {
        addDoc(calleeCandidatesCollection, e.candidate.toJSON());
      }
    };

    try {
      await pc.current.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
      hasSetRemoteDesc.current = true;

      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);

      await updateDoc(callDocRef, {
        answer: { type: answer.type, sdp: answer.sdp },
        status: "answered"
      });

      while (candidateQueue.current.length > 0) {
        const cand = candidateQueue.current.shift();
        await addCandidateSafely(cand);
      }
    } catch (err) {
      console.error("Error during call acceptance:", err);
    }

    onSnapshot(callerCandidatesCollection, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          addCandidateSafely(change.doc.data());
        }
      });
    });
  };

  const toggleMute = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const cleanupConnection = () => {
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    hasSetRemoteDesc.current = false;
    candidateQueue.current = [];
  };

  const hangUp = async (isManual = true) => {
    cleanupConnection();

    if (isManual) {
      const callStatus = isAnswered ? "answered" : "missed";
      
      await addDoc(collection(db, "rooms", roomId, "messages"), {
        text: callType === "video" ? "Video Call" : "Audio Call",
        type: "call_history",
        callStatus: callStatus,
        senderId: currentUserUid,
        timestamp: serverTimestamp(),
      });

      await updateDoc(callDocRef, { status: "ended" });
    }
    
    onClose();
  };

  const isIncomingAudioBanner = incomingCallData && !hasAccepted && callType === "audio";

  return (
    <div className="call-overlay" style={{ 
      position: 'fixed', 
      top: isIncomingAudioBanner ? '20px' : '0', 
      left: isIncomingAudioBanner ? '50%' : '0', 
      transform: isIncomingAudioBanner ? 'translateX(-50%)' : 'none',
      width: isIncomingAudioBanner ? '90%' : '100%', 
      maxWidth: isIncomingAudioBanner ? '400px' : '100%',
      height: isIncomingAudioBanner ? 'auto' : '100%', 
      backgroundColor: isIncomingAudioBanner ? '#ffffff' : 'rgba(0,0,0,0.9)', 
      borderRadius: isIncomingAudioBanner ? '12px' : '0',
      boxShadow: isIncomingAudioBanner ? '0 8px 24px rgba(0,0,0,0.2)' : 'none',
      padding: isIncomingAudioBanner ? '16px' : '0',
      zIndex: 9999, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: isIncomingAudioBanner ? 'flex-start' : 'center' 
    }}>
      
      {/* Hidden Audio Element for Remote Voice Output */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Receiver Ringing Screen for Audio (4:1 Banner style) */}
      {isIncomingAudioBanner ? (
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '45px', height: '45px', borderRadius: '50%', backgroundColor: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px' }}>
              <FiPhone />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', color: '#111b21' }}>Incoming Audio Call</h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#667781' }}>Ringing...</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={acceptCall} style={{ padding: '10px', borderRadius: '50%', border: 'none', backgroundColor: '#25D366', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Accept">
              <FiPhone size={18} />
            </button>
            <button onClick={() => hangUp(true)} style={{ padding: '10px', borderRadius: '50%', border: 'none', backgroundColor: '#ea4335', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Decline">
              <FiPhoneOff size={18} />
            </button>
          </div>
        </div>
      ) : incomingCallData && !hasAccepted ? (
        /* Receiver Ringing Screen for Video (Full Screen) */
        <div style={{ textAlign: 'center', color: 'white' }}>
          <h2 style={{ marginBottom: '10px' }}>Incoming Video Call...</h2>
          <p style={{ marginBottom: '30px', color: '#ccc' }}>Someone is calling you</p>
          
          <div style={{ display: 'flex', gap: '30px', justifyContent: 'center' }}>
            <button onClick={acceptCall} style={{ padding: '20px', borderRadius: '50%', border: 'none', backgroundColor: '#2ed573', color: 'white', cursor: 'pointer' }}>
              <FiPhone size={28} />
            </button>
            <button onClick={() => hangUp(true)} style={{ padding: '20px', borderRadius: '50%', border: 'none', backgroundColor: '#ff4757', color: 'white', cursor: 'pointer' }}>
              <FiPhoneOff size={28} />
            </button>
          </div>
        </div>
      ) : (
        /* Connected / Calling Screen */
        <>
          <h2 style={{ color: isIncomingAudioBanner ? '#111b21' : 'white', marginBottom: '20px' }}>
            {isAnswered ? (callType === 'video' ? 'Video Connected' : 'Audio Connected') : 'Ringing...'}
          </h2>
          
          {callType === 'audio' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '48px', marginBottom: '15px' }}>
                <FiUser />
              </div>
              <p style={{ color: '#aaa', fontSize: '14px' }}>{isAnswered ? "Voice Call Active" : "Calling..."}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '150px', height: '200px', backgroundColor: '#333', borderRadius: '10px', objectFit: 'cover', display: isVideoOff ? 'none' : 'block' }} />
              {isVideoOff && (
                <div style={{ width: '150px', height: '200px', backgroundColor: '#222', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
                  <FiVideoOff size={32} />
                </div>
              )}
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '300px', height: '400px', backgroundColor: '#222', borderRadius: '10px', objectFit: 'cover' }} />
            </div>
          )}

          {/* Call Control Buttons */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <button onClick={toggleMute} style={{ padding: '15px', borderRadius: '50%', border: 'none', backgroundColor: isMuted ? '#ff4757' : '#555', color: 'white', cursor: 'pointer' }} title="Toggle Mic">
              {isMuted ? <FiMicOff size={24} /> : <FiMic size={24} />}
            </button>
            
            {callType === 'video' && (
              <button onClick={toggleVideo} style={{ padding: '15px', borderRadius: '50%', border: 'none', backgroundColor: isVideoOff ? '#ff4757' : '#555', color: 'white', cursor: 'pointer' }} title="Toggle Camera">
                {isVideoOff ? <FiVideoOff size={24} /> : <FiVideo size={24} />}
              </button>
            )}

            <button onClick={() => hangUp(true)} style={{ padding: '15px', borderRadius: '50%', border: 'none', backgroundColor: '#ff4757', color: 'white', cursor: 'pointer' }} title="End Call">
              <FiPhoneOff size={24} />
            </button>
          </div>
        </>
      )}

    </div>
  );
};

export default CallModal;
