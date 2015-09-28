////////////////////admin.js////////////////////
function addUser() {
	if($('#username').textbox('getText') === ''){
		$("#addResult").html("用户名称不能为空！");
		return;
	}
	if($('#password').textbox('getText') === ''){
		$("#addResult").html("用户密码不能为空！");
		return;
	}
	if($('#deviceid').textbox('getText') === ''){
		$("#addResult").html("设备编号不能为空！");
		return;
	}
	var intDevId = parseInt($('#deviceid').textbox('getText'));
	if(intDevId < 1 || intDevId > 65535){
		$("#addResult").html("设备编号超出取值范围，请重新输入！");
		return;
	}
	$("#addResult").html("");
	$.post('addUser',{username: $('#username').textbox('getText'), 
					password: $('#password').textbox('getText'), 
					deviceid:$('#deviceid').textbox('getText')},
	function(data, status){
		if (data === 'success'){
			$("#addResult").html("");
			$('#dg').datagrid('reload');
		} else if(data === 'session expired'){
			window.location = "/";
		}
		else {
			$("#addResult").html(data);
		}
	});		
}
function modifyPwd() {		
	if($('#username').textbox('getText') === ''){
		$("#addResult").html("用户名称不能为空！");
		return;
	}
	if($('#password').textbox('getText') === ''){
		$("#addResult").html("用户密码不能为空！");
		return;
	}
	if($('#password')[0].data && $('#password').textbox('getText') === $('#password')[0].data){
		$("#addResult").html("密码未更改！");
		return;
	}
	$("#addResult").html("");
	$.post('modifyUser',{username: $('#username').textbox('getText'), password: $('#password').textbox('getText')},function(data, status){
		if (data === 'success'){
			$('#password')[0].data = $('#password').textbox('getText');
			$("#addResult").html("修改密码成功！");
			$('#dg').datagrid('reload');
		} else if(data === 'session expired'){
			window.location = "/";
		}
		else {
			$("#addResult").html(data);
		}
	});		
} 	
function clickRow(index,row){
	var row = $('#dg').datagrid('getSelected');
	if(!row) return;
	$('#username').textbox('setText', row.username);
	$('#username')[0].data = row.username;
	$('#password').textbox('setText', row.password);
	$('#password')[0].data = row.password;			
	$('#deviceid').textbox('setText', row.deviceId);
	$('#deviceid')[0].data = row.deviceId;
}
function operation(val,row,index){  
	$('#dg').datagrid('selectRow',index);
	return '<a href="#" style="font-size:16px;" onclick="deleteUser('+index+')">删除</a>';
}
function deleteUser(index){  
	$('#dg').datagrid('selectRow',index);
	var row = $('#dg').datagrid('getSelected');		
	$.post('deleteUser',{name: row.username},function(data, status){
		if (data === 'success'){
			$("#result").css({"color":"black"});
			$('#dg').datagrid('reload');
		}else if(data === 'session expired'){
			window.location = "/";
		}
		else {
			$("#delResult").css({"color":"red"});
			$("#delResult").html("删除失败！");
		}
	});			
}

////////////////////home.js////////////////////
function modPwdClick(){
	$('#oldpwd').attr("value","");
	$('#newpwd').attr("value","");
	$('#mdresult').html('');
	$('#w').window('open');
}
function modifyMyPwd(){
	if($('#oldpwd').textbox('getText') === ''){
		$("#mdresult").html("旧密码不能为空！");
		return;
	}
	if($('#newpwd').textbox('getText') === ''){
		$("#mdresult").html("新密码不能为空！");
		return;
	}
	//===============================>添加代码
	$.post('modifyPwd',{oldpwd:$('#oldpwd').textbox('getText'),newpwd:$('#newpwd').textbox('getText')}, function(data, status){
		if (data === 'success'){
			$('#w').window('close');
		}
		else if (data === 'session expired'){
			window.location = "/";
		}
		else {
			$("#mdresult").html(data);
		}
	});
}
function addDevice() {
	if($('#username').textbox('getText') === ''){
		$("#addResult").html("用户ID不能为空！");
		return;
	}
	var intUserId = parseInt($('#username').textbox('getText'));
	if(intUserId < 1 || intUserId > 65535){
		$("#addResult").html("用户ID超出取值范围，请重新输入！");
		return;
	}
	if($('#channel').textbox('getText') === ''){
		$("#addResult").html("频道号不能为空！");
		return;
	}
	var intChannel = parseInt($('#channel').textbox('getText'));
	if(intChannel < 1 || intChannel > 20){
		$("#addResult").html("频道号超出取值范围，请重新输入！");
		return;
	}
	$.post('addDevice',{username: $('#username').textbox('getText'), channel: $('#channel').textbox('getText')},function(data, status){
		if (data === 'success'){
			$("#addResult").html("");
			$('#dg').datagrid('reload');
		} else if(data === 'session expired'){
			window.location = "/";
		}
		else {
			$("#addResult").html(data);
		}
	});		
}
function sendMsg() {
	var row = $('#dg').datagrid('getSelected');
	$("#result").html("");
	if (!row){
		$("#result").css({"color":"red"});
		$("#result").html("请选中一行");
		return;
	}
	if($('#content').textbox('getText') === ''){
		$("#result").css({"color":"red"});
		$("#result").html("发送内容不能为空！");
		return;
	}
	$.post('sendMessage',{userid:row.userid, channel:row.channel, message: $('#content').textbox('getText')}, function(data, status){
		if (data === 'success'){
			$("#result").css({"color":"black"});
			$("#result").html("发送成功！");
			$('#hisdg').datagrid('reload');
		} else if(data === 'session expired'){
			window.location = "/";
		}
		else {
			$("#result").css({"color":"red"});
			$("#result").html(data);				
		}
	});
}
function clear() {
	$.post('clearHistory', {}, function(data, status){
		if (data === 'success'){
			$('#hisdg').datagrid('reload');
		}
		if(data === 'session expired'){
			window.location = "/";
		}
	});
}
function setID() {
    var row = $('#dg').datagrid('getSelected');
    $("#delResult").html("");
    if (!row){
            $("#delResult").css({"color":"red"});
            $("#delResult").html("请选中一行");
            return;
    }
    $.post('setID', {userid:row.userid, channel:row.channel}, function(data, status){
            if (data === 'success'){
                    $("#delResult").css({"color":"black"});
                    $("#delResult").html("设置成功");
            } else if(data === 'session expired'){
                    window.location = "/";
            }
            else {
                    $("#delResult").css({"color":"red"});
                    $("#delResult").html(data);
            }
    });
}
function remoteDel() {
	var row = $('#dg').datagrid('getSelected');	
	$("#delResult").html("");
	if (!row){
		$("#delResult").css({"color":"red"});
		$("#delResult").html("请选中一行");
		return;
	}
	$.post('remoteDelete', {userid:row.userid, channel:row.channel}, function(data, status){
		if (data === 'success'){
			$("#delResult").css({"color":"black"});
			$("#delResult").html("删除成功");
		} else if(data === 'session expired'){
			window.location = "/";
		}
		else {
			$("#delResult").css({"color":"red"});
			$("#delResult").html(data);
		}
	});
}
function formatRetrans(val,row,index){
	$('#hisdg').datagrid('selectRow',index);
	return '<a href="#" style="font-size:16px;" onclick="retransmit('+index+')">重发</a>';
}
function retransmit(index){
	$('#hisdg').datagrid('selectRow',index);
	var row = $('#hisdg').datagrid('getSelected');
	$.post('sendMessage',{userid:row.userid, channel:row.channel, message: row.message},function(data, status){
		if (data === 'success'){
			$("#retransResult").css({"color":"black"});
			$("#retransResult").html("发送成功！");
			$('#hisdg').datagrid('reload');
		} else if(data === 'session expired'){
			window.location = "/";
		}
		else {
			$("#retransResult").css({"color":"red"});
			$("#retransResult").html(data);
		}
	});
}
function formatOper(val,row,index){  
	$('#dg').datagrid('selectRow',index);
	return '<a href="#" style="font-size:16px;" onclick="deleteDevice('+index+')">删除</a>';
}
function deleteDevice(index){
	$('#dg').datagrid('selectRow',index);
	var row = $('#dg').datagrid('getSelected');		
	$.post('deleteDevice',{id: row._id},function(data, status){
		if (data === 'success'){
			$("#result").css({"color":"black"});
			$('#dg').datagrid('reload');
		}else if(data === 'session expired'){
			window.location = "/";
		}
		else {
			$("#delResult").css({"color":"red"});
			$("#delResult").html("删除失败！");
		}
	});
} 