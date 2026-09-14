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
import { FiPhoneOff, FiPhone, FiMic, FiMicOff } from "react-icons/fi";
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

  const pc = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const isMounted = useRef(true);
  const hasSetRemoteDesc = useRef(false);
  const candidateQueue = useRef([]);

  const callDocRef = doc(db, "rooms", roomId, "calls", "currentCall");
  const callerCandidatesCollection = collection(callDocRef, "callerCandidates");
  const calleeCandidatesCollection = collection(callDocRef, "calleeCandidates");

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

  const createPeerConnection = () => {
    pc.current = new RTCPeerConnection(servers);
    pc.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };
  };

  const getMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === "video",
        audio: true,
      });
      if (!isMounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
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
      // Ignore benign duplicate candidate errors
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

    // Firestore Answer Listener (Ref-based locking)
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

          // Drain queued candidates
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

    // Callee Candidates Listener
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
      setIsAnswered(true);

      // Drain queued candidates
      while (candidateQueue.current.length > 0) {
        const cand = candidateQueue.current.shift();
        await addCandidateSafely(cand);
      }
    } catch (err) {
      console.error("Error during call acceptance:", err);
    }

    // Caller Candidates Listener
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

  return (
    <div className="call-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* Receiver Ringing Screen */}
      {incomingCallData && !hasAccepted ? (
        <div style={{ textAlign: 'center', color: 'white' }}>
          <h2 style={{ marginBottom: '10px' }}>Incoming {callType === 'video' ? 'Video' : 'Audio'} Call...</h2>
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
          <h2 style={{ color: 'white', marginBottom: '20px' }}>
            {isAnswered ? (callType === 'video' ? 'Video Connected' : 'Audio Connected') : 'Ringing...'}
          </h2>
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
            {callType === 'video' && (
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '150px', height: '200px', backgroundColor: '#333', borderRadius: '10px', objectFit: 'cover' }} />
            )}
            {callType === 'video' && (
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '300px', height: '400px', backgroundColor: '#222', borderRadius: '10px', objectFit: 'cover' }} />
            )}
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <button onClick={toggleMute} style={{ padding: '15px', borderRadius: '50%', border: 'none', backgroundColor: isMuted ? '#ff4757' : '#555', color: 'white', cursor: 'pointer' }}>
              {isMuted ? <FiMicOff size={24} /> : <FiMic size={24} />}
            </button>
            <button onClick={() => hangUp(true)} style={{ padding: '15px', borderRadius: '50%', border: 'none', backgroundColor: '#ff4757', color: 'white', cursor: 'pointer' }}>
              <FiPhoneOff size={24} />
            </button>
          </div>
        </>
      )}

    </div>
  );
};

export default CallModal;