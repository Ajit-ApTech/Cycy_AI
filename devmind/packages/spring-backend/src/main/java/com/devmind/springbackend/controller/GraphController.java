package com.devmind.springbackend.controller;

import com.devmind.springbackend.model.CodeNode;
import com.devmind.springbackend.model.SourceFile;
import com.devmind.springbackend.repository.CodeNodeRepository;
import com.devmind.springbackend.repository.SourceFileRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/graph")
public class GraphController {
    
    private final SourceFileRepository sourceFileRepository;
    private final CodeNodeRepository codeNodeRepository;

    public GraphController(SourceFileRepository sourceFileRepository, CodeNodeRepository codeNodeRepository) {
        this.sourceFileRepository = sourceFileRepository;
        this.codeNodeRepository = codeNodeRepository;
    }

    @GetMapping("/files")
    public List<SourceFile> getAllFiles() {
        return sourceFileRepository.findAll();
    }

    @GetMapping("/nodes")
    public List<CodeNode> getAllNodes() {
        return codeNodeRepository.findAll();
    }

    @PostMapping("/files")
    public SourceFile addFile(@RequestBody SourceFile file) {
        return sourceFileRepository.save(file);
    }
}
