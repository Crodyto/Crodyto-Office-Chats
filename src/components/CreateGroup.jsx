import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore"; 
import { db } from "../firebase";

const CreateGroup = ({ currentUserUid }) => {
  const [groupName, setGroupName] = useState("");

  // Step 4 er Group Create function ta ekhane thakbe
  const handleCreateGroup = async (e) => {
    e.preventDefault(); // Page refresh bondho korar jonnye
    
    // Dhoro nicher ID gulo tumi select korecho UI theke
    const selectedEmployeeIds = ["employee_1_uid", "employee_2_uid"]; 

    try {
      const participants = [...selectedEmployeeIds, currentUserUid];
      await addDoc(collection(db, "chatRooms"), {
        type: "group",
        groupName: groupName,
        participants: participants,
        createdAt: serverTimestamp(),
      });
      alert("Group created successfully!");
      setGroupName(""); // Input field faka korar jonnye
    } catch (error) {
      console.error("Error creating group: ", error);
    }
  };

  return (
    <form onSubmit={handleCreateGroup}>
      <input 
        type="text" 
        placeholder="Group Name" 
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)} 
      />
      <button type="submit">Create Group</button>
    </form>
  );
};

export default CreateGroup;